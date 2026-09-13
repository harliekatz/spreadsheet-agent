import { sampleSheets } from "./samples";
import type { Chat } from "@/hooks/useChats";

const examples = [
  { index: 0, prompt: "Create a low inventory report with vendor and restock date." },
  { index: 1, prompt: "Show promotion-eligible products with margin above 40 percent." },
  { index: 6, prompt: "Create an inventory report for Northstar Supply." },
];

export const sampleChats: Chat[] = examples.map(({ index, prompt }) => {
  const sheet = sampleSheets[index];
  return {
    id: `demo-chat-${sheet.id}`,
    title: sheet.title,
    sheet,
    updatedAt: sheet.updatedAt,
    messages: [
      { role: "user", text: prompt },
      {
        role: "assistant",
        text: `Built ${sheet.title}: ${sheet.rows.length} rows and ${sheet.columns.length} columns from the Northwind Goods catalog.`,
      },
    ],
  };
});
