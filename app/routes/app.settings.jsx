import {
  Card,
  Page,
  Button,
  TextField,
  FormLayout,
  ButtonGroup, // Polaris v13 hook
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useActionData } from "@remix-run/react";

import database from "../db.server";

// loader function to fetch existing rate
export async function loader() {
  const prevRate = await database.SaveRates.findFirst({
    orderBy: { id: "desc" },
  });
  return json(prevRate);
}
/* ------------------------------------------------------------------ */
/*  Action: upsert on the same row (id = 1) or create it once         */
/* ------------------------------------------------------------------ */
export async function action({ request }) {
  const raw = Object.fromEntries(await request.formData());

  if (!raw.gold22K || !raw.gold18K) {
    return json({ error: "Both rates are required." }, { status: 400 });
  }
  const goldRate22K = Number(raw.gold22K);
  const goldRate18K = Number(raw.gold18K);

  const latest = await database.SaveRates.findFirst({
    orderBy: { id: "desc" },
  });

  const dbData = await database.SaveRates.upsert({
    where: { id: latest?.id ?? 1 },
    update: { goldRate22K, goldRate18K },
    create: { id: 1, goldRate22K, goldRate18K },
  });

  if (!dbData) {
    return json({ error: "ERROR! Rates not saved..." }, { status: 500 });
  }
  return json({ ...dbData, success: true });
}

/* ------------------------------------------------------------------ */
/*  React component                                                   */
/* ------------------------------------------------------------------ */
export default function Settings() {
  /* data from server */
  const prevRate = useLoaderData(); // may be null
  const actionData = useActionData(); // result after submit

  /* local form state */
  const [formState, setFormState] = useState({
    goldRate22K: prevRate?.goldRate22K ?? "",
    goldRate18K: prevRate?.goldRate18K ?? "",
  });

  // Show toast on successful save/update
  useEffect(() => {
    if (actionData && actionData.success) {
      if (window.shopify?.toast) {
        window.shopify.toast.show("Gold rates saved successfully!");
      } else if (typeof shopify !== "undefined" && shopify.toast) {
        shopify.toast.show("Gold rates saved successfully!");
      } else {
        // fallback: alert
        alert("Gold rates saved successfully!");
      }
      setFormState({
        goldRate22K: actionData.goldRate22K,
        goldRate18K: actionData.goldRate18K,
      });
    }
    if (actionData && actionData.error) {
      if (window.shopify?.toast) {
        window.shopify.toast.show(actionData.error);
      } else if (typeof shopify !== "undefined" && shopify.toast) {
        shopify.toast.show(actionData.error);
      } else {
        alert(actionData.error);
      }
    }
  }, [actionData]);

  return (
    <Page>
      <Card>
        <TitleBar title="Set Gold Rate" />

        <Form method="POST">
          <FormLayout>
            <FormLayout.Group>
              <TextField
                type="number"
                label="Gold 22K Rate"
                name="gold22K"
                value={formState.goldRate22K?.toString() ?? ""}
                onChange={(value) =>
                  setFormState((s) => ({ ...s, goldRate22K: value }))
                }
                helpText="Enter the 22K Gold rate per gram"
              />
              <TextField
                type="number"
                label="Gold 18K Rate"
                name="gold18K"
                value={formState.goldRate18K?.toString() ?? ""}
                onChange={(value) =>
                  setFormState((s) => ({ ...s, goldRate18K: value }))
                }
                helpText="Enter the 18K Gold rate per gram"
              />
            </FormLayout.Group>
            <ButtonGroup>
              <Button
                submit
                primary
                disabled={!formState.goldRate22K || !formState.goldRate18K}
              >
                Save
              </Button>
              <Button url="/app/apply" variant="primary">
                Update Products
              </Button>
            </ButtonGroup>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}
