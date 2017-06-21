import assert from 'assert';
import sinon from 'sinon';
import deleteProperty from './../../src/functions/deleteProperty.js';
import CustomEnricher from './../../src/enrichments/CustomEnricher.js';
import EventManager from './../../src/EventManager';
import Storage from './../../src/Storage.js';
import DDStorage from './../../src/DDStorage.js';

describe('CustomEnricher', () => {

  const digitalData = {
    test: 1,
    changes: [],
  };
  let ddListener = [];
  let ddStorage = new DDStorage(digitalData, new Storage());
  let customEnricher = new CustomEnricher(digitalData, ddStorage);
  let eventManager;

  beforeEach(() => {
    ddStorage = new DDStorage(digitalData, new Storage());
    eventManager = new EventManager(digitalData, ddListener);
    eventManager.initialize();
  });

  afterEach(() => {
    ddStorage.clear();
    eventManager.reset();
    customEnricher.reset();
    digitalData.user = {};
  });

  it('should enrich digitalData', () => {
    customEnricher.addEnrichment('digitalData', 'user.visitedWebsite', function() {
      return this.get('user.visitedWebsite1') && this.get('user.visitedWebsite2');
    }, {
      dependencies: ['user.visitedWebsite1', 'user.visitedWebsite2'],
    });

    customEnricher.addEnrichment('digitalData', 'user.visitedWebsite1', function() {
      return true;
    });

    customEnricher.addEnrichment('digitalData', 'user.visitedWebsite2', function() {
      return true;
    });

    customEnricher.enrichDigitalData(digitalData);
    assert.equal(digitalData.user.visitedWebsite1, true);
    assert.equal(digitalData.user.visitedWebsite2, true);
    assert.equal(digitalData.user.visitedWebsite1, true);
  });

  it('should enrich digitalData with recursion protection', () => {

    customEnricher.addEnrichment('digitalData', 'user.visitedWebsite1', function() {
      return this.get('user.visitedWebsite2');
    }, {
      dependencies: ['user.visitedWebsite2'],
    });

    customEnricher.addEnrichment('digitalData', 'user.visitedWebsite2', function() {
      return this.get('user.visitedWebsite1');
    }, {
      dependencies: ['user.visitedWebsite1'],
    });

    customEnricher.enrichDigitalData(digitalData);
    assert.equal(digitalData.changes.length, 0);
  });

  it('should enrich digitalData on event', () => {
    customEnricher.addEnrichment('digitalData', 'user.hasTransacted', function() {
      this.getQueryParam('test');
      this.get('user.test');
      this.getCookie('test');
      return true;
    }, {
      events: ['Completed Transaction'],
      persist: true,
      persistTtl: 3600
    });

    customEnricher.enrichDigitalData(digitalData, { name: 'Completed Transaction'});
    assert.deepEqual(digitalData.changes[0], ['user.hasTransacted', true, 'DDManager Custom Enrichment']);
  });

});
