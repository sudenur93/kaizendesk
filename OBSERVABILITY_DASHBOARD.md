# KaizenDesk Observability (OpenSearch)

Bu doküman, OpenSearch Dashboards üzerinde kurulan log tabanlı gözlemlenebilirlik panellerini özetler.

## Veri kaynağı
- Index pattern: `logstash-*`
- Time field: `@timestamp`

## Filtre mantığı
`log` alanı JSON string olarak geldiği için; panel sorgularında aşağıdaki yaklaşım kullanılır:
- `serviceName` ve `level` gibi değerler doğrudan ayrı field olarak görünmeyebileceğinden `log` içinde arama yapılır.
- `log:kaizendesk-api` filtrelemesi servis adını hedefler.
- `log:ERROR` filtrelemesi hata seviyesini hedefler.

## Paneller
1. `Request Volume`
   - Filtre: `log:kaizendesk-api`
   - Amaç: Zaman içinde API tarafına gelen log hacmini görmek.

2. `Error Count`
   - Filtre: `log:kaizendesk-api AND log:ERROR`
   - Amaç: Zaman içinde oluşan hata kayıt sayısını görmek.

3. `Error Frequency`
   - Filtre: `log:kaizendesk-api AND log:ERROR`
   - Amaç: Hataların zamanla yoğunluğunu takip etmek.

4. `Top Error Logs`
   - Filtre: `log:kaizendesk-api AND log:ERROR`
   - Amaç: En çok görülen hata log içeriklerini/top kayıtlarını görmek.

## Notlar
- `Top N` (terms) agregasyonlarının düzgün çalışabilmesi için Fluent Bit tarafında log satırı uzunluğu sınırlandırılır.
- Log4j2 tarafında exception içeriği kısa formatta üretilerek `log.keyword` için indexlenebilirlik artırılır.

