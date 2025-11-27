import express, { Request, Response } from "express";
import * as cheerio from "cheerio";
import xml from "xml";

interface RssItem {
  title: string;
  link: string;
  description: string;
}

const app = express();

/**
 * Fetches a LinkedIn newsletter page and converts it to a simple RSS feed.
 * You’ll likely want to refine the selectors once you see your real HTML.
 */
async function generateRssForNewsletter(newsletterId: string): Promise<string> {
  const url = `https://www.linkedin.com/newsletters/${newsletterId}/`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch newsletter page (${res.status} ${res.statusText})`
    );
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const title =
    $("title").first().text().trim() || `LinkedIn Newsletter ${newsletterId}`;
  const link = url;
  const description = `RSS feed for LinkedIn newsletter ${newsletterId}`;

  const items: RssItem[] = [];

  // TODO: adjust this selector to your actual layout
  // This is just a placeholder: look for article links under the newsletter.
  $('a[href*="/pulse/"]').each((_, el) => {
    const href = $(el).attr("href");
    const itemTitle = $(el).text().trim();

    if (!href || !itemTitle) return;

    const normalizedLink = href.startsWith("http")
      ? href
      : `https://www.linkedin.com${href}`;

    items.push({
      title: itemTitle,
      link: normalizedLink,
      description: itemTitle,
    });
  });

  const rssObj = [
    {
      rss: [
        { _attr: { version: "2.0" } },
        {
          channel: [
            { title },
            { link },
            { description },
            ...items.map((item) => ({
              item: [
                { title: item.title },
                { link: item.link },
                { description: item.description },
              ],
            })),
          ],
        },
      ],
    },
  ];

  return xml(rssObj, { declaration: true });
}

// Route: GET /:id → RSS XML
app.get("/:id", async (req: Request, res: Response) => {
  try {
    const newsletterId = req.params.id;

    if (!newsletterId) {
      res.status(400).send("Missing newsletter ID");
      return;
    }

    const rss = await generateRssForNewsletter(newsletterId);
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(rss);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating RSS");
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`LinkedIn newsletter RSS server listening on port ${port}`);
});
