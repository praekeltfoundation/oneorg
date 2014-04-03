# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'MetricSummary'
        db.create_table(u'metrics_manager_metricsummary', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('country_code', self.gf('django.db.models.fields.CharField')(max_length=6)),
            ('channel', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['metrics_manager.Channel'])),
            ('metric', self.gf('django.db.models.fields.CharField')(max_length=50)),
            ('total', self.gf('django.db.models.fields.IntegerField')()),
        ))
        db.send_create_signal(u'metrics_manager', ['MetricSummary'])

        # Adding model 'IncomingData'
        db.create_table(u'metrics_manager_incomingdata', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('created_at', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, blank=True)),
            ('source_timestamp', self.gf('django.db.models.fields.DateTimeField')()),
            ('channel', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['metrics_manager.Channel'])),
            ('channel_uid', self.gf('django.db.models.fields.CharField')(max_length=255)),
            ('msisdn', self.gf('django.db.models.fields.CharField')(max_length=100, null=True, blank=True)),
            ('email', self.gf('django.db.models.fields.CharField')(max_length=255, null=True, blank=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=255, null=True, blank=True)),
            ('farmer', self.gf('django.db.models.fields.NullBooleanField')(null=True, blank=True)),
            ('budget_enough', self.gf('django.db.models.fields.NullBooleanField')(null=True, blank=True)),
            ('budget_think', self.gf('django.db.models.fields.CharField')(max_length=5, null=True, blank=True)),
            ('budget_should', self.gf('django.db.models.fields.CharField')(max_length=5, null=True, blank=True)),
            ('sex', self.gf('django.db.models.fields.CharField')(max_length=6, null=True, blank=True)),
            ('age', self.gf('django.db.models.fields.CharField')(max_length=5, null=True, blank=True)),
            ('country_code', self.gf('django.db.models.fields.CharField')(max_length=6, null=True, blank=True)),
            ('location', self.gf('django.db.models.fields.CharField')(max_length=100, null=True, blank=True)),
            ('download_mp3', self.gf('django.db.models.fields.NullBooleanField')(null=True, blank=True)),
            ('download_ringback', self.gf('django.db.models.fields.NullBooleanField')(null=True, blank=True)),
        ))
        db.send_create_signal(u'metrics_manager', ['IncomingData'])

        # Adding model 'Channel'
        db.create_table(u'metrics_manager_channel', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=10)),
        ))
        db.send_create_signal(u'metrics_manager', ['Channel'])


    def backwards(self, orm):
        # Deleting model 'MetricSummary'
        db.delete_table(u'metrics_manager_metricsummary')

        # Deleting model 'IncomingData'
        db.delete_table(u'metrics_manager_incomingdata')

        # Deleting model 'Channel'
        db.delete_table(u'metrics_manager_channel')


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
            'country_code': ('django.db.models.fields.CharField', [], {'max_length': '6', 'null': 'True', 'blank': 'True'}),
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
            'country_code': ('django.db.models.fields.CharField', [], {'max_length': '6'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'metric': ('django.db.models.fields.CharField', [], {'max_length': '50'}),
            'total': ('django.db.models.fields.IntegerField', [], {})
        }
    }

    complete_apps = ['metrics_manager']