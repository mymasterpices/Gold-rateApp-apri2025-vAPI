import {
  Card,
  Page,
  Button,
  TextField,
  FormLayout,
  ButtonGroup,            // Polaris v13 hook
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useActionData } from "@remix-run/react";

import database from "../db.server";

/* ------------------------------------------------------------------ */
/*  Loader: fetch the latest saved rate                               */
/* ------------------------------------------------------------------ */
export async function loader() {
  const currentRate = await database.SaveRates.findFirst({
    orderBy: { id: "desc" },     // newest row if any
  });

  if (!currentRate) {
    console.log("No previously saved rates");
  } else {
    console.log(`Previous → Gold rate: ${currentRate.goldRate}`);
  }

  return json(currentRate);      // may be null
}

/* ------------------------------------------------------------------ */
/*  Action: upsert on the same row (id = 1) or create it once         */
/* ------------------------------------------------------------------ */
export async function action({ request }) {
  const raw = Object.fromEntries(await request.formData());
  const goldRate = Number(raw.gold22K);

  const latest = await database.SaveRates.findFirst({
    orderBy: { id: "desc" },
  });

  const dbData = await database.SaveRates.upsert({
    where: { id: latest?.id ?? 1 },         // update if exists, else create
    update: { goldRate },
    create: { id: 1, goldRate },
  });

  if (!dbData) console.error("Error updating the rate");

  return json(dbData);
}

/* ------------------------------------------------------------------ */
/*  React component                                                   */
/* ------------------------------------------------------------------ */
export default function Settings() {
  /* data from server */
  const prevRate = useLoaderData();     // may be null
  const actionData = useActionData();   // result after submit

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
            <TextField
              type="number"
              label="Gold 22K Rate"
              name="gold22K"
              value={formState.goldRate?.toString() ?? ""}
              onChange={(value) =>
                setFormState((s) => ({ ...s, goldRate: value }))
              }
              helpText="Enter the Gold rate per gram"
            />

            <ButtonGroup>
              <Button submit primary>
                Save
              </Button>
              <Button url="/app/apply" variant="primary">Update Products</Button>
            </ButtonGroup>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}
