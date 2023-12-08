import { Context, Schema, Time, h } from "koishi";
import * as fs from "fs";
import { } from "koishi-plugin-puppeteer";
import type { Page } from "puppeteer-core";

// 插件名称
export const name = "anime-of-the-day";

// 需要的前置插件
export const inject = ["puppeteer"];

// 插件配置
export interface Config {}
export const Config: Schema<Config> = Schema.object({});

/**
 * 根据提供的模板和数据生成字符串。
 * @param template 模板字符串
 * @param data 数据对象，包含模板中需要替换的键值对
 * @returns 生成的字符串
 * @example
 * const template = "Hello, {name}! Today is {day}.";
 * const data = { name: "Alice", day: "Monday" };
 * const result = templater(template, data);
 * // result: "Hello, Alice! Today is Monday."
 */
export function templater(template: string, data: { [key: string]: any }) {
  return template.replace(/{(.*?)}/g, (_, key) => data[key] || "");
}

/**
 * 创建页面并设置内容。
 * @param temp - 模板字符串。
 * @param ctx - 上下文对象。
 * @returns 创建的页面。
 * @example
 * const temp = "<h1>Hello, World!</h1>";
 * const ctx = { puppeteer: puppeteerInstance };
 * const page = await createPage(temp, ctx);
 */
async function createPage(temp, ctx) {
  const page: Page = await ctx.puppeteer.page();
  await page.setContent(
    templater(temp, {
      element: "",
      background: "#eee",
    }),
    {
      waitUntil: ['networkidle0']
    }
  );
  return page;
}

export function apply(ctx: Context, config: Config) {


  ctx.middleware(async (session, next) => {
    if (session.content === "今日番剧") {
      session.send('正在获取今日番剧数据，请稍后...')
      const date = new Date();
      const dateFormat = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      try {
        const file = fs.readFileSync(`./downloads/anime-of-the-day/${dateFormat}.png`) as any;
        session.send(h.image(file));
      } catch (error) {
        await ctx.http
          .get(`https://api.bgm.tv/calendar`)
          .then(async (res) => {
            let idx = new Date().getDay();
            if (idx === 0) idx = 6;
            else idx -= 1;
            // 今日数据
            const data = res[idx];

            const str = data.items.reduce((prev, cur) => {
              if (!prev) {
                prev += `
                  <h1 style="display: inline-block;margin:10px 0 0 0;">
                    每日放送
                    <h2 style="display: inline-block;margin:10px 0 0 14px;">${dateFormat} ${data.weekday.cn}</h2>
                  </h1>
                `;
              }
              prev += `
                <div style="display: flex; border-radius: 20px; margin: ${prev ? "14px" : "0"} 10px 0 10px;background: white;box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1);padding:10px;">
                  <div style="margin-right: 14px">
                    <image src="${cur.images.large}" style="height:100px; border-radius: 10px;"></image>
                  </div>
                  <div>
                    <h2 style="margin: 0">${cur.name_cn || cur.name}</h2>
                    <div style="color: #666;font-size:12px;">${cur.name}</div>
                    <div>${cur.air_date}</div>
                    ${cur.rating ? "<div><b>Bangumi</b>评分：" + cur.rating.score + "</div>" : ""}
                  </div>
                </div>
              `;
              return prev;
            }, "");
            const page1 = await createPage(`<div style="width: 700px;" id="main">${str}</div>`, ctx);
            const el = await page1.$("#main");
  
            await el.screenshot().then((res) => {
              session.send(h.image(res));
              try {
                fs.writeFileSync(`./downloads/anime-of-the-day/${dateFormat}.png`, res);
              } catch (error) {
                fs.mkdirSync("./downloads/anime-of-the-day", { recursive: true });
                fs.writeFileSync(`./downloads/anime-of-the-day/${dateFormat}.png`, res);
              }
              page1.close();
            });
          })
          .catch((err) => {
            exports.logger.error(`获取今日番剧时出错: ${err}`);
            return "获取今日番剧失败";
          });
      }
    }
    return next();
  });
}
