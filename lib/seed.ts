import { sql } from './db';
import fs from 'fs';
import path from 'path';
import "dotenv/config"

function parseDate(dateString: string | undefined | null): string | null {
  if (!dateString) {
    return null;
  }
  
  // Skip header row values
  if (dateString === 'Date Joined') {
    return null;
  }
  
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  console.warn(`Could not parse date: ${dateString}`);
  return null;
}

export async function seed() {
  const createTable = await sql`
    CREATE TABLE IF NOT EXISTS unicorns (
      id SERIAL PRIMARY KEY,
      company VARCHAR(255) NOT NULL UNIQUE,
      valuation DECIMAL(10, 2) NOT NULL,
      date_joined DATE,
      country VARCHAR(255) NOT NULL,
      city VARCHAR(255) NOT NULL,
      industry VARCHAR(255) NOT NULL,
      select_investors TEXT NOT NULL
    );
  `;

  console.log(`Created "unicorns" table`);

  const results: any[] = [];
  const csvFilePath = path.join(process.cwd(), 'unicorns.csv');
  
  // Check if the file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`CSV file not found: ${csvFilePath}`);
    console.error('Please download the unicorns dataset and save it as unicorns.csv in the project root');
    return {
      createTable,
      unicorns: [],
    };
  }

  // Read the file line by line and process it manually
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = fileContent.split('\n');
  
  // Skip the first 3 lines (header information) and process the rest
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // The first character is a comma - this is the empty first column
    // So we need to add a dummy value at the start to make the CSV parser work
    const fixedLine = 'dummy' + line;
    
    // Parse this line as CSV
    const row = fixedLine.split(',');
    
    // Only process rows with enough fields
    if (row.length < 7) continue;
    
    // Extract the fields (column 0 is our dummy)
    const company = row[1] ? row[1].trim() : '';
    if (!company) continue;
    
    let valuation = 0;
    if (row[2]) {
      const valStr = row[2].replace('$', '').replace(',', '').trim();
      valuation = parseFloat(valStr) || 0;
    }
    
    const dateJoined = parseDate(row[3] ? row[3].trim() : null);
    const country = row[4] ? row[4].trim() : '';
    const city = row[5] ? row[5].trim() : '';
    const industry = row[6] ? row[6].trim() : '';
    
    // The select investors might contain commas, so we need to join the rest of the fields
    let investors = '';
    if (row.length > 7) {
      investors = row.slice(7).join(',').trim();
      // Remove surrounding quotes if present
      if (investors.startsWith('"') && investors.endsWith('"')) {
        investors = investors.substring(1, investors.length - 1);
      }
    }
    
    try {
      await sql`
        INSERT INTO unicorns (company, valuation, date_joined, country, city, industry, select_investors)
        VALUES (
          ${company},
          ${valuation},
          ${dateJoined},
          ${country},
          ${city},
          ${industry},
          ${investors}
        )
        ON CONFLICT (company) DO NOTHING;
      `;
      results.push({
        company,
        valuation,
        dateJoined,
        country,
        city,
        industry,
        investors
      });
    } catch (error) {
      console.error(`Error inserting row for company: ${company}`, error);
    }
  }

  console.log(`Seeded ${results.length} unicorns`);

  return {
    createTable,
    unicorns: results,
  };
}

seed().catch(console.error);