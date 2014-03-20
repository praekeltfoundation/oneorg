from celery import task
import csv
from metrics_manager.models import IncomingData
from datetime import datetime


@task()
def ingest_csv(csv_data, channel):
    records = csv.reader(csv_data, delimiter=',', quotechar='"')
    if channel.name == "mxit":
        for line in records:
            if len(line) == 7 and line[0] != "Date": 
                incoming_data = IncomingData()
                incoming_data.source_timestamp = datetime.strptime(line[0], "%Y-%m-%d %H:%M:%S")
                incoming_data.channel = channel
                incoming_data.channel_uid = line[1]
                incoming_data.save()
