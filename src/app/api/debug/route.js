import { getSheetData } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getSheetData();
    return Response.json({
      success: true,
      fetchedAt: new Date().toISOString(),
      rowCount: data.length,
      firstRow: data[0] || null,
      lastRow: data[data.length - 1] || null,
      sample: data.slice(-3),
    });
  } catch (err) {
    return Response.json({
      success: false,
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5),
    });
  }
}
