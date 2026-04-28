import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getSheetData } from "@/lib/googleSheets";
import { processData } from "@/lib/dataProcessing";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || "All";

  try {
    const rawData = await getSheetData();
    const processed = processData(rawData, month);
    return Response.json(processed, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return Response.json(
      { error: "Failed to fetch data from Google Sheets" },
      { status: 500 }
    );
  }
}
