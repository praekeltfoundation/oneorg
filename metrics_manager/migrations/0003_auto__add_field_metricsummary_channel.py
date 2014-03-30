# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding field 'MetricSummary.channel'
        db.add_column(u'metrics_manager_metricsummary', 'channel',
                      self.gf('django.db.models.fields.related.ForeignKey')(default=1, to=orm['metrics_manager.Channel']),
                      keep_default=False)


    def backwards(self, orm):
        # Deleting field 'MetricSummary.channel'
        db.delete_column(u'metrics_manager_metricsummary', 'channel_id')


    models = {
        u'metrics_manager.channel': {
            'Meta': {'object_name': 'Channel'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '10'})
        },
        u'metrics_manager.incomingdata': {
            'Meta': {'object_name': 'IncomingData'},
            'age': ('django.db.models.fields.CharField', [], {'max_length': '5', 'null': 'True', 'blank': 'True'}),
            'budget_enough': ('django.db.models.fields.NullBooleanField', [], {'null': 'True', 'blank': 'True'}),
            'budget_should': ('django.db.models.fields.CharField', [], {'max_length': '5', 'null': 'True', 'blank': 'True'}),
            'budget_think': ('django.db.models.fields.CharField', [], {'max_length': '5', 'null': 'True', 'blank': 'True'}),
            'channel': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['metrics_manager.Channel']"}),
            'channel_uid': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'country_code': ('django.db.models.fields.CharField', [], {'max_length': '2', 'null': 'True', 'blank': 'True'}),
            'created_at': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'download_mp3': ('django.db.models.fields.NullBooleanField', [], {'null': 'True', 'blank': 'True'}),
            'download_ringback': ('django.db.models.fields.NullBooleanField', [], {'null': 'True', 'blank': 'True'}),
            'email': ('django.db.models.fields.CharField', [], {'max_length': '255', 'null': 'True', 'blank': 'True'}),
            'farmer': ('django.db.models.fields.NullBooleanField', [], {'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'location': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            'msisdn': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '255', 'null': 'True', 'blank': 'True'}),
            'sex': ('django.db.models.fields.CharField', [], {'max_length': '6', 'null': 'True', 'blank': 'True'}),
            'source_timestamp': ('django.db.models.fields.DateTimeField', [], {})
        },
        u'metrics_manager.metricsummary': {
            'Meta': {'object_name': 'MetricSummary'},
            'channel': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['metrics_manager.Channel']"}),
            'country_code': ('django.db.models.fields.CharField', [], {'max_length': '2'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'metric': ('django.db.models.fields.CharField', [], {'max_length': '50'}),
            'total': ('django.db.models.fields.IntegerField', [], {})
        }
    }

    complete_apps = ['metrics_manager']