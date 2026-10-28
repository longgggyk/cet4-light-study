# 四级轻学

一个内容优先、无需注册的四级备考网站。围绕2026年12月12日考试，准备了45天、每天约30分钟的学习任务。

## 先开始学习

**电脑最省事的方式**：直接用Chrome或Edge打开随包提供的 `四级轻学-直接打开.html`。词句、阅读练习、判题和本地笔记不需要安装依赖；真题与新闻链接需要联网。

**手机和电脑连接同一个Wi-Fi**：在Windows上双击 `启动学习.cmd`。它会打开电脑页面，并在窗口中显示手机可尝试的局域网地址。手机浏览器输入这个地址即可。需要保持电脑和启动窗口运行；Windows若询问防火墙权限，只允许专用网络。网络若启用了设备隔离，手机可能无法访问电脑，此时使用下文的公开部署方式。

也可以手动运行：

```text
python start.py --lan
```

地址被占用时：

```text
python start.py --lan --port 8766
```

## 已准备的内容

- 18套四级试卷来源：2023年12月、2024年6月与12月、2025年6月与12月、2026年6月，各3套。
- 18套试卷与答案链接；17套页面提供音频入口，部分套卷共用音频文件。
- 2026年6月第2套原页未提供独立音频，页面明确标记；相关每日听力任务改用同考次第1套，阅读仍使用第2套。
- 首次核验：18个网页成功访问；47个不同的PDF或MP3链接返回正确文件类型，检查了文件头。没有把整份试卷复制到本站。
- 200个备考常用词、60个双语例句与句型提示。
- 12篇原创阅读练习，每篇约159–175词，带中文参考、词汇说明和3道理解题，共36题。
- 每日任务默认5分钟词句、10分钟听力、10分钟阅读、5分钟复盘；周三将阅读替换为翻译片段练习，周六替换为写作提纲与开头。
- 初始新闻推荐已从News in Levels的RSS取得。推荐日期与原文发布日期分别标明。

真题通过原站作答，不在本站自动读取答题结果。完成后返回首页，手动勾选任务并记录错题原因。原创文章是教学设计，不是真题、真实人物报道或可引用的新闻事实。B1/B1+仅为选材时的难度建议。

## 收藏与备份

收藏、任务完成、单词掌握自评、阅读结果、笔记均保存在当前浏览器的localStorage中。不同浏览器、不同设备、不同访问地址之间不自动同步。

在“收藏笔记”中导出JSON备份，换设备时导入。导入会合并有效记录，保留已有笔记。清除网站数据前请先备份。

## 只用GitHub账号免费上线

项目已附带GitHub Pages发布工作流，不需要先注册其他云服务账号。

1. 把整个项目上传到自己的公开GitHub仓库，默认分支使用 `main`。
2. 在仓库 Settings → Pages 中选择 GitHub Actions 作为发布来源。
3. 在 Actions 中运行 **Deploy study site**。成功后，Pages页面会给出正式HTTPS网址，手机浏览器可直接访问，无需注册网站账号。
4. 在 Actions 中运行一次 **Update learning resources**，验证文章检查、数据提交和随后触发的自动部署。之后按每天北京时间07:20的计划运行，平台调度可能有延迟。

GitHub Pages在不同手机网络下的可达性仍需实测。若访问不稳定，可继续使用以下EdgeOne备用方案，学习网站代码无需重写。

`deploy-pages.yml`同时监听内容更新工作流结束事件，并检出最新 `main` 分支。这是为了让定时任务提交数据后也能重新发布，而不依赖机器人提交再次触发普通push工作流。

## 备用免费部署：EdgeOne Pages/Makers

网站代码已经完整，不需要购买服务器或AI额度。正式公开部署仍需要网站所有者登录免费服务账号并授权；仓库和云账号都应属于你。无需向聊天发送密码或密钥。

1. 在[GitHub](https://github.com/new)创建一个公开仓库，例如 `cet4-light-study`，上传本项目根目录中的文件，保留 `.github/workflows/`。**不要上传你的学习记录备份**。
2. 登录[腾讯云EdgeOne Pages](https://console.cloud.tencent.com/edgeone/pages)或[EdgeOne Makers](https://edgeone.ai/)，只选择免费档。导入该GitHub仓库，授权读取你选择的仓库。
3. 框架选择Other/静态网站；根目录为仓库根目录，构建命令留空，输出目录填写 `public`。本项目已生成所有静态文件，不需要npm install或构建服务器。
4. 部署后先用控制台预览链接检查页面。需要长期手机访问时，继续绑定免费子域名。官方文档说明默认域名在大陆网络使用的预览链接有效期为3小时，不能把它当作长期学习网址：[域名说明](https://pages.edgeone.ai/document/domain-overview)。
5. 在[ClouDNS](https://www.cloudns.net/)注册免费账号，创建 **Free zone**，从当时提供的后缀中申请可用的免费主机名。它提供免费主机名和CNAME管理：[官方Free Zone说明](https://www.cloudns.net/wiki/article/31/)。不要选择收费套餐或试用升级。
6. 在该免费主机名下使用一个子域名，例如免费区域为 `mycet4.cloudns.ph`，网站使用 `learn.mycet4.cloudns.ph`。在EdgeOne项目域名管理中添加这个网站域名，区域选择**全球可用区（不含中国大陆）**。将EdgeOne给出的CNAME目标填入ClouDNS，记录名称填写 `learn`，并按页面要求补充验证记录、完成免费HTTPS证书签发。使用子域名可以避免根域名CNAME与SOA/NS记录冲突。主机名能否被接受，以两个服务的实际控制台结果为准；若被拒绝，不要自动购买域名。
7. 用手机普通网络打开最终HTTPS域名，检查页面、音频和外站练习入口。免费域名与境外节点的实际可达性需要手机实测，不能保证所有运营商或未来时段始终稳定。
8. 确认下节的GitHub定时任务已启用并成功运行一次。若采用直接上传，后续不会自动收到仓库更新，需重新上传；要自动更新请采用Git仓库导入。

若只想先预览，可把 `网站静态部署.zip` 上传到EdgeOne的直接上传入口。该压缩包只包含可部署的静态文件，不包含定时任务。全部源码和自动更新任务位于 `四级轻学-完整项目.zip`。

当前交付不等于已经在你的EdgeOne账号中发布。只有取得正式HTTPS地址、完成手机实测，且定时任务运行并触发新部署后，才算完成公开上线验收。

## 每日内容更新

工作流 `.github/workflows/update-content.yml` 计划每天北京时间07:20运行，也支持GitHub Actions页面的 **Run workflow**。平台调度可能延迟。

更新会：

1. 读取News in Levels公开RSS，只保存标题、原文地址和发布日期，不收集第三方文章全文或音频。
2. 检查真题目录与已收录网页的可用性；新发现的试卷先标记为待核验，不自动混入训练任务。
3. 遇到来源故障保留上次可用推荐和成功时间，记录本次检查失败。
4. 校验数据后提交 `public/data/latest.json` 与 `public/latest.js`，自动触发GitHub Pages部署；使用EdgeOne时，也可由它的Git集成部署新版本。

设置时确认仓库允许Actions运行并允许工作流写入。首次手动运行后，确认对应的部署工作流成功，再查看站内“最近检查”时间是否更新。若长时间没有更新，请查看Actions日志和部署记录；页面不会假装内容一直在实时更新。

手动更新命令（仅使用Python标准库，无API密钥）：

```text
python scripts/update_content.py
python -m unittest discover -s tests -v
```

更新器全源失败或部分源失败时会返回非零状态，供工作流报告问题；已经写入的状态文件保留旧的可用文章。不要把失败后的旧文章日期改成今天。

## 修改内容与检查

`public/data/` 保存浏览器使用的数据；`public/content.js` 是生成后的静态内容包。内容原稿与最初核验记录位于 `content/`。

修改原稿后：

```text
python scripts/seed_content.py
python scripts/build.py
python -m unittest discover -s tests -v
node --test tests/learning.test.cjs
```

生成可直接打开的单文件页面：

```text
python scripts/build.py --bundle 四级轻学-直接打开.html
```

修改 `public/data/readings.json` 即可调整原创短文；单词和例句原稿分别为 `content/words.tsv` 和 `content/sentences.tsv`。更新2026年12月考试目标需同时调整任务生成器与考试日期，不要只修改首页文案。

## 内容来源与参考

- [四级考试结构与分值比例](https://cet.neea.edu.cn/html1/folder/16113/1586-1.htm)
- [南京大学四级自测资源](https://eol.nju.edu.cn/cet4/)
- [CET通备用真题库](https://www.cettong.cn/library/cet4)
- [News in Levels](https://www.newsinlevels.com/)
- [Qwerty Learner](https://github.com/RealKai42/qwerty-learner)、[TypeWords](https://github.com/zyronon/TypeWords)、[Lute](https://github.com/LuteOrg/lute-v3)：仅借鉴学习流程，没有复制这些项目的源码或素材。详见 `THIRD_PARTY.md`。

这是学习工具，不承诺考试结果，不把练习正确率换算成正式四级成绩。
