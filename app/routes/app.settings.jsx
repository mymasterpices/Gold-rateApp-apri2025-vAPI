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

/* ------------------------------------------------------------------ */
/*  Action: upsert on the same row (id = 1) or create it once         */
/* ------------------------------------------------------------------ */
export async function action({ request }) {
  const raw = Object.fromEntries(await request.formData());

  if (raw.gold22K == null) {
    return toast.show("Rate can't be blank", { duration: 2000 });
  }
  const goldRate22K = Number(raw.gold22K);
  const goldRate18K = Number(raw.gold18K);

  const latest = await database.SaveRates.findFirst({
    orderBy: { id: "desc" },
  });

  const dbData = await database.SaveRates.upsert({
    where: { id: latest?.id ?? 1 }, // update if exists, else create
    update: { goldRate22K, goldRate18K },
    create: { id: 1, goldRate22K, goldRate18K },
  });

  if (!dbData) {
    toast.show("ERROR!, Rates not saved...", { duration: 2000 });
  }
  console.log("Saved rate:", dbData);
  return json(dbData);
}

/* ------------------------------------------------------------------ */
/*  React component                                                   */
/* ------------------------------------------------------------------ */
export default function Settings() {
  /* data from server */
  const prevRate = ""; // may be null
  const actionData = useActionData(); // result after submit

  /* toast helper */
  const toast = shopify.toast;

  useEffect(() => {
    if (actionData) {
      toast.show("Success! New rate saved.", { duration: 2000 });
    }
  }, [actionData, toast]);

  /* local form state */
  const [formState, setFormState] = useState({
    goldRate: prevRate?.goldRate ?? "",
  });

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
              {/* <TextField
                type="number"
                label="Gold 14K Rate"
                name="gold22K"
                value={formState.goldRate14K?.toString() ?? ""}
                onChange={(value) =>
                  setFormState((s) => ({ ...s, goldRate14K: value }))
                }
                helpText="Enter the Gold rate per gram"
              /> */}
            </FormLayout.Group>
            <ButtonGroup>
              <Button submit primary>
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
