import React, { useState } from "react";
import { Page, Layout, Card, Button, BlockStack, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useFetcher } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import database from "../db.server";

export async function action({ request }) {
  const current_rate = await database.SaveRates.findFirst();
  if (!current_rate) {
    console.log("Gold and GST rate not updated");
    return json({ error: "No current rates found." }, { status: 400 });
  }

  try {
    const { admin } = await authenticate.admin(request);

    let hasNextPage = true;
    let endCursor = null;
    let totalProductsUpdated = 0;

    while (hasNextPage) {
      const response = await admin.graphql(
        `
          query ($cursor: String) {
            products(first: 250, query: "tag:Gold_22K OR tag:Gold_18K", after: $cursor) {
              edges {
                node {
                  id
                  tags
                  variants(first: 1) {
                    nodes {
                      id
                      title
                      price
                    }
                  }
                  metafields(first: 10) {
                    edges {
                      node {
                        key
                        value
                      }
                    }
                  }
                }
              }
              pageInfo {
                endCursor
                hasNextPage
              }
            }
          }
        `,
        {
          variables: { cursor: endCursor },
        },
      );

      const result = await response.json();

      if (!result.data || !result.data.products) {
        throw new Error("Unexpected API response structure");
      }

      const goldProducts = result.data.products.edges;

      if (goldProducts.length > 0) {
        for (const product of goldProducts) {
          const { id, metafields, variants, tags } = product.node;

          // Determine gold rate based on tags
          let goldRate = null;
          if (tags.includes("Gold_22K") || tags.includes("gold_22k")) {
            goldRate = current_rate.goldRate22K;
          } else if (tags.includes("Gold_18K") || tags.includes("gold_18k")) {
            goldRate = current_rate.goldRate18K;
          } else {
            continue; // Skip if neither tag is present
          }

          // Extract metafields safely
          let goldWeight = 0;
          let makingCharges = 0;
          let stonePrice = 0;

          if (metafields && metafields.edges.length > 0) {
            metafields.edges.forEach(({ node: { key, value } }) => {
              if (key === "gold_weight") {
                goldWeight = parseFloat(value) || 0;
              } else if (key === "making_charges") {
                makingCharges = parseFloat(value) || 0;
              } else if (key === "stone_price") {
                stonePrice =
                  value === null || value === undefined || value === ""
                    ? 0
                    : parseFloat(value) || 0;
              }
            });
          }

          // Get the default variant ID
          const variantId =
            variants.nodes.length > 0 ? variants.nodes[0].id : null;

          if (!variantId) {
            console.log(`No variant found for Product ID: ${id}`);
            continue;
          }

          // GST rate is fixed at 3%
          const gstRate = 3;

          // Price calculations
          const goldActualPrice = goldRate * goldWeight;
          const goldMakingAmount =
            ((stonePrice + goldActualPrice) * makingCharges) / 100;
          const gstAmount =
            ((stonePrice + goldMakingAmount + goldActualPrice) * gstRate) / 100;
          const newPrice = Math.round(
            goldActualPrice + goldMakingAmount + stonePrice + gstAmount,
          );

          try {
            // Update the variant price using a GraphQL mutation
            const updateResponse = await admin.graphql(
              `#graphql
                mutation UpdateProductVariantsPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                    productVariants {
                      id
                      price
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `,
              {
                variables: {
                  productId: id,
                  variants: [
                    {
                      id: variantId,
                      price: newPrice,
                    },
                  ],
                },
              },
            );

            const updateResult = await updateResponse.json();
            if (
              updateResult.data &&
              !updateResult.data.productVariantsBulkUpdate.userErrors.length
            ) {
              totalProductsUpdated++;
              console.log(
                `✅ Updated Product ${id} with new Price: ₹${newPrice}`,
              );
            } else {
              console.error(
                `❌ Error updating Product ID: ${id}`,
                updateResult.data.productVariantsBulkUpdate.userErrors,
              );
            }
          } catch (err) {
            console.error(`Error updating product ID ${id}:`, err.message);
          }
        }
      } else {
        console.log("No products found with 'Gold_22K' or 'Gold_18K' tags.");
      }

      const pageInfo = result.data.products.pageInfo;
      hasNextPage = pageInfo.hasNextPage;
      endCursor = pageInfo.endCursor;

      if (!hasNextPage) {
        console.log("✅ No more pages to fetch.");
      }
    }

    return json({
      success: true,
      message: "All products successfully updated",
    });
  } catch (err) {
    console.error("Error during processing:", err.message);
    return json({ error: err.message });
  }
}

export default function Apply() {
  const fetcher = useFetcher();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = () => {
    setLoading(true);
    setSuccess(false);
  };

  React.useEffect(() => {
    if (fetcher.data?.success) {
      setLoading(false);
      setSuccess(true);
    } else if (fetcher.data?.error) {
      setLoading(false);
    }
  }, [fetcher.data]);

  return (
    <Page>
      <TitleBar title="Update New Rate" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack>
                <Text variant="headingMd" as="h2">
                  Set new gold rate for the entire store
                </Text>
                <fetcher.Form method="post" onSubmit={handleSubmit}>
                  <p>
                    Updating the gold product pricing will affect the product
                    rate on the live website.
                  </p>
                  <br />
                  <Button variant="primary" submit loading={loading}>
                    {success
                      ? "All products successfully updated"
                      : loading
                        ? "Updating..."
                        : "Update"}
                  </Button>
                </fetcher.Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
