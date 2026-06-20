import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { files } = await req.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY is not configured on the server." },
        { status: 400 }
      );
    }

    // Prepare content parts for Gemini
    const textPrompt = `Extract all individual line items with names and prices from these receipt screenshots or PDF documents.
Also, find the overall Grand Total (the final amount paid for the entire bill, including taxes, fees, and discounts) and return it in the 'grandTotal' field.

Return a JSON object with:
1. 'items': A JSON array of objects, where each object has keys 'name' (string) and 'price' (number).
2. 'grandTotal': A number representing the grand total of the bill. If not found, return 0.

Rules for items extraction:
- If there is an item-level discount or deal that reduces the price of a specific item, extract the final net price paid for that item rather than its original pre-discount price.
- If an item has a quantity greater than 1, split it into separate individual items with a quantity of 1 and their corresponding unit price (e.g. if the receipt says '2 x Onion  ₹58.0', return two separate items: 'Onion (1/2)' with price 29.0, and 'Onion (2/2)' with price 29.0).
- If individual item prices are missing from the receipt but a grand total is present, divide the grand total evenly ONLY among the main food/beverage/product items, NOT among free add-ons, seasonings, sauces, or carry bags.
- Ignore free items, zero-priced items, or free seasonings/condiments/add-ons (e.g. Oregano sachets, Chilli Flakes sachets, ketchup packets, tissues, carry bags) if they have a price of 0, are included for free, or have negligible/no price listed.
- Ignore billing summaries like listing price, subtotal, taxes, cgst, sgst, round off, global discounts (discounts applied to the entire bill), delivery fee, handling fee, or payment information.
- If there are continuation screenshots with overlapping items, merge them and do not list duplicate items.
- Ensure the prices match the item prices listed next to them. Do not include currency symbols in the price number.`;

    const parts = [
      { text: textPrompt },
      ...files.map((file: any) => ({
        inlineData: {
          mimeType: file.type,
          data: file.base64
        }
      }))
    ];

    const payload = {
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  price: { type: "NUMBER" }
                },
                required: ["name", "price"]
              }
            },
            grandTotal: { type: "NUMBER" }
          },
          required: ["items", "grandTotal"]
        }
      }
    };

    const GEMINI_MODELS = [
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash-lite-preview-02-05",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];

    let lastError: any = null;
    let textResult = "";

    for (const model of GEMINI_MODELS) {
      try {
        console.log(`Attempting OCR with model: ${model}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const apiResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          console.warn(`Gemini API call failed for model ${model}:`, errorText);
          lastError = new Error(`Model ${model} failed: ${apiResponse.status} ${apiResponse.statusText}. Response: ${errorText}`);
          continue; // Try the next model
        }

        const resData = await apiResponse.json();
        textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResult) {
          console.warn(`Gemini API returned empty content for model ${model}`, JSON.stringify(resData));
          lastError = new Error(`Model ${model} returned empty content.`);
          continue; // Try the next model
        }

        console.log(`OCR successfully completed using model: ${model}`);
        break; // Successfully got result, stop checking models
      } catch (err: any) {
        console.warn(`Error during OCR attempt with model ${model}:`, err.message);
        lastError = err;
      }
    }

    if (!textResult) {
      console.error("All Gemini models failed to process the OCR request.");
      return NextResponse.json(
        { success: false, error: `All Gemini models failed. Last error: ${lastError?.message || "Unknown error"}` },
        { status: 502 }
      );
    }

    // Parse the JSON string from Gemini
    const ocrResult = JSON.parse(textResult);
    const items = (ocrResult.items || []).map((item: any) => ({
      name: item.name,
      price: Math.round((parseFloat(item.price) || 0) * 100) / 100
    }));
    const grandTotal = parseFloat(ocrResult.grandTotal) || 0;

    return NextResponse.json({
      success: true,
      items: items,
      grandTotal: grandTotal
    });
  } catch (err: any) {
    console.error("OCR API Route Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
