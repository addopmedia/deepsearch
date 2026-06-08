# DeepSearch Apps — Market Analytics

Аналитический дашборд по нише iOS-приложений DeepSearch / People Search (4 приложения).
Данные: AppstoreSpy (revenue / installs estimates). Статический сайт, без бэкенда.

**Live:** https://<username>.github.io/deepsearch-apps/

## Что внутри

Три вкладки:
- **Таблица** — все приложения с метриками: revenue 12mo/30d, выручка по годам, YoY, тренд, downloads, RPD, рейтинг, тип паблишера, реклама, гео.
- **Рост по годам** — revenue по календарным годам + рост Δ% год-к-году (по каждому апу и итог по нише).
- **Revenue по месяцам** — pivot-таблица помесячной выручки с heatmap + sparkline.

Клик по строке → детальная карточка с графиками installs/revenue по месяцам.

## Метрики

- **Trend**: `accel = revenue_30d / (revenue_12mo / месяцев)`. ≥1.2 → растёт, <0.8 → падает.
- **YoY ниши**: like-for-like рост (только апы с полной базой прошлого года). В этой нише почти все апы моложе года, поэтому YoY рассчитан на малой базе — для контекста смотри годовые колонки `'24/'25/'26`.
- **'26** — неполный год (данные до ~апреля 2026), Δ% к нему занижен.

## Публикация на GitHub Pages

1. Создать репозиторий на github.com (например `deepsearch-apps`).
2. Залить все файлы из этой папки в корень репозитория.
3. Settings → Pages → Source: `Deploy from a branch` → Branch `main` / `(root)` → Save.
4. Через 1-2 минуты сайт доступен по адресу выше.

Файлы: `index.html`, `app.js`, `styles.css`, `data.json`, `.nojekyll`.
