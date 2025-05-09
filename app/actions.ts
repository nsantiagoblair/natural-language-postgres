"use server";

import { query } from "@/lib/db";
import { Result } from "@/lib/types";
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { sqlQueryPrompt } from './system_prompts/sql_query';
import { sqlExplainPrompt } from './system_prompts/sql_explain';
import { explanationSchema, configSchema } from '@/lib/types';


/**
 * Executes a SQL query and returns the result data
 * @param {string} query - The SQL query to execute
 * @returns {Promise<Result[]>} Array of query results
 * @throws {Error} If query is not a SELECT statement or table doesn't exist
 */
export const runGeneratedSQLQuery = async (sqlQuery: string) => {
  "use server";
  // Ensure the query is a SELECT statement. Otherwise, throw an error
  if (
    !sqlQuery.trim().toLowerCase().startsWith("select") ||
    sqlQuery.trim().toLowerCase().includes("drop") ||
    sqlQuery.trim().toLowerCase().includes("delete") ||
    sqlQuery.trim().toLowerCase().includes("insert") ||
    sqlQuery.trim().toLowerCase().includes("update") ||
    sqlQuery.trim().toLowerCase().includes("alter") ||
    sqlQuery.trim().toLowerCase().includes("truncate") ||
    sqlQuery.trim().toLowerCase().includes("create") ||
    sqlQuery.trim().toLowerCase().includes("grant") ||
    sqlQuery.trim().toLowerCase().includes("revoke")
  ) {
    throw new Error("Only SELECT queries are allowed");
  }

  let data: any;
  try {
    data = await query(sqlQuery);
  } catch (e: any) {
    if (e.message.includes('relation "unicorns" does not exist')) {
      console.log(
        "Table does not exist, creating and seeding it with dummy data now...",
      );
      // throw error
      throw Error("Table does not exist");
    } else {
      throw e;
    }
  }

  return data.rows as Result[];
};




export const generateQuery = async (input: string) => {
  'use server';
  try {
    const result = await generateObject({
      model: openai('gpt-4o'),
      system: sqlQueryPrompt,
      prompt: `Generate the query necessary to retrieve the data the user wants: ${input}`,
      schema: z.object({
        query: z.string(),
      }),
    });
    return result.object.query;
  } catch (e) {
    console.error(e);
    throw new Error('Failed to generate query');
  }
};

export const explainQuery = async (input: string, sqlQuery: string) => {
  'use server';
  try {
    const result = await generateObject({
      model: openai('gpt-4o'),
      system: sqlExplainPrompt,
      prompt: `Explain the SQL query you generated to retrieve the data the user wanted. Assume the user is not an expert in SQL. Break down the query into steps. Be concise.

      User Query:
      ${input}

      Generated SQL Query:
      ${sqlQuery}`,
      schema: explanationSchema,
      output: 'array',
    },);
    return result.object;
  } catch (e) {
    console.error(e);
    throw new Error('Failed to generate query');
  }
};


export const generateChartConfig = async (
  results: Result[],
  userQuery: string,
) => {
  'use server';

  try {
    const { object: config } = await generateObject({
      model: openai('gpt-4o'),
      system: 'You are a data visualization expert.',
      prompt: `Given the following data from a SQL query result, generate the chart config that best visualises the data and answers the users query.
      For multiple groups use multi-lines.

      Here is an example complete config:
      export const chartConfig = {
        type: "pie",
        xKey: "month",
        yKeys: ["sales", "profit", "expenses"],
        colors: {
          sales: "#4CAF50",    // Green for sales
          profit: "#2196F3",   // Blue for profit
          expenses: "#F44336"  // Red for expenses
        },
        legend: true
      }

      User Query:
      ${userQuery}

      Data:
      ${JSON.stringify(results, null, 2)}`,
      schema: configSchema,
    });

    // Override with shadcn theme colors
    const colors: Record<string, string> = {};
    config.yKeys.forEach((key, index) => {
      colors[key] = `hsl(var(--chart-${index + 1}))`;
    });

    const updatedConfig = { ...config, colors };
    return { config: updatedConfig };
  } catch (e) {
    console.error(e);
    throw new Error('Failed to generate chart suggestion');
  }
};