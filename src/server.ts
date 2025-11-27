import express, { Request, Response } from "express";
import * as cheerio from "cheerio";
import xml from "xml";

const app = express();

async function generateRssForNewsletter(
  newsletterId: string,
  selfUrl: string
): Promise<string> {
  const url = `https://www.linkedin.com/newsletters/${newsletterId}`;
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  const link = url;
  const title = $("h1").text().trim();
  const description = $("h2").text().trim();
  const imageUrl =
    $(".newsletter__top-card-image img").attr("data-delayed-url") ?? "";

  const rss: any[] = [
    {
      rss: [
        {
          _attr: {
            version: "2.0",
            "xmlns:atom": "http://www.w3.org/2005/Atom",
          },
        },
        {
          channel: [
            {
              image: [
                { title },
                { link },
                {
                  url: imageUrl,
                },
              ],
            },
            { title },
            { link },
            { description },
            { docs: "https://www.rssboard.org/rss-specification" },
            {
              "atom:link": {
                _attr: {
                  href: selfUrl,
                  rel: "self",
                  type: "application/rss+xml",
                },
              },
            },
            { generator: "https://github.com/chrisns/linkedin-newsletter-rss" },
          ],
        },
      ],
    },
  ];

  const channel = (rss[0] as any).rss[1].channel as any[];

  const articleElements = $(
    "section.newsletter__editions-container ul.newsletter__updates div.share-article"
  );

  for (const item of articleElements.toArray()) {
    const article = $(item);
    const rawHref = article.find("a").attr("href");
    if (!rawHref) continue;

    const articleLink = rawHref.split("?")[0];

    const articleRes = await fetch(articleLink);
    const articleHtml = await articleRes.text();
    const $Content = cheerio.load(articleHtml);

    const img = $Content("img.cover-img__image").attr("src") ?? "";
    const itemTitle = $Content("h1").text().trim();
    const metaText = $Content(".base-main-card__metadata").text();
    const pubDate = metaText.split("Published")[1]?.trim() ?? "";
    const itemDescription = $Content(".article-main__content").html() ?? "";
    const author = $Content(".publisher-author-card h3").text().trim();

    channel.push({
      item: [
        { title: itemTitle },
        { author },
        { link: articleLink },
        { guid: articleLink },
        { pubDate },
        { description: { _cdata: itemDescription } },
        {
          enclosure: {
            _attr: {
              url: img,
              type: "image/jpeg",
              length: "100",
            },
          },
        },
      ],
    });
  }

  const xmlString = xml(rss, { declaration: true, indent: "  " });
  return xmlString;
}

// GET /:id → RSS XML
app.get("/:id", async (req: Request, res: Response) => {
  try {
    const newsletterId = req.params.id;

    if (!newsletterId) {
      res.status(400).send("Missing newsletter ID");
      return;
    }

    // Build self URL (what subscribers/clients see as the feed URL)
    const selfUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const rssXml = await generateRssForNewsletter(newsletterId, selfUrl);

    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(rssXml);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating RSS");
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`LinkedIn newsletter RSS server listening on port ${port}`);
});
