BOT_NAME = 'systemfehler'
SPIDER_MODULES = ['systemfehler.spiders']
NEWSPIDER_MODULE = 'systemfehler.spiders'
ROBOTSTXT_OBEY = True
DOWNLOAD_TIMEOUT = 5
RETRY_ENABLED = True
RETRY_TIMES = 1
ITEM_PIPELINES = {
    'systemfehler.pipelines.SQLitePipeline': 300,
}
