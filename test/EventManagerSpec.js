import assert from 'assert';
import reset from './reset.js';
import EventManager from './../src/EventManager.js';
import nextTick from 'next-tick';

describe('EventManager', () => {

  let _eventManager;

  afterEach(() => {
    if (_eventManager) {
      _eventManager.reset();
      _eventManager = undefined;
    }
    reset();
  });

  describe('working with events:', () => {

    const eventTemplate = {
      action: 'Added Product',
      category: 'Ecommerce'
    };

    beforeEach(() => {
      window.digitalData = {
        events: []
      };
      window.ddListener = [];
      _eventManager = new EventManager(window.digitalData, window.ddListener);
    });

    it('should add time and hasFired fields to event', () => {
      let event = Object.assign({}, eventTemplate);

      _eventManager.initialize();

      window.digitalData.events.push(event);

      assert.ok(window.digitalData.events.length == 1);
      assert.ok(window.digitalData.events[0].time > 100000);
      assert.ok(window.digitalData.events[0].hasFired);
    });

    it('should process callback for event', () => {
      let event = Object.assign({}, eventTemplate);
      let callbackFired = false;
      let receivedEvent;

      _eventManager.initialize();

      window.ddListener.push(['on', 'event', (e) => {
        callbackFired = true;
        receivedEvent = e;
      }]);
      window.digitalData.events.push(event);

      assert.ok(callbackFired);
      assert.equal(receivedEvent.action, event.action);
      assert.equal(receivedEvent.category, event.category);
    });


    it('should process early callback for event', () => {
      let event = Object.assign({}, eventTemplate);
      let callbackFired = false;
      let receivedEvent;

      window.ddListener.push(['on', 'event', (e) => {
        callbackFired = true;
        receivedEvent = e;
      }]);

      _eventManager.initialize();

      window.digitalData.events.push(event);

      assert.ok(callbackFired);
      assert.equal(receivedEvent.action, event.action);
      assert.equal(receivedEvent.category, event.category);
    });

    it('should process early callback for early event', () => {
      let event = Object.assign({}, eventTemplate);
      let callbackFired = false;
      let receivedEvent;

      window.ddListener.push(['on', 'event', (e) => {
        callbackFired = true;
        receivedEvent = e;
      }]);
      window.digitalData.events.push(event);

      _eventManager.initialize();

      assert.ok(callbackFired);
      assert.equal(receivedEvent.action, event.action);
      assert.equal(receivedEvent.category, event.category);
    });

  });

  describe(': listening for digitalData changes', () => {

    beforeEach(() => {
      window.digitalData = {
        user: {
          returning: false
        },
        listing: {
          items: [
            {id: 1},
            {id: 2}
          ]
        },
        test: 'test'
      };
      window.ddListener = [];
      _eventManager = new EventManager(window.digitalData, window.ddListener);
      _eventManager.initialize();
    });

    it('should fire change callback', (done) => {
      window.ddListener.push(['on', 'change', () => {
        done();
      }]);
      window.digitalData.test2 = 'test2';
    });

    it('should fire change key callback', (done) => {
      window.ddListener.push(['on', 'change:user.returning', (newValue, previousValue) => {
        assert.ok(newValue === true);
        assert.ok(previousValue === false);
        done();
      }]);
      window.digitalData.user.returning = true;
    });

    it('should fire change callback for array', (done) => {
      window.ddListener.push(['on', 'change:listing.items', (newValue, previousValue) => {
        assert.ok(newValue.length === 3);
        assert.ok(previousValue.length === 2);
        done();
      }]);
      window.digitalData.listing.items.push({id: 3});
    });

    it('should fire length change callback for array', (done) => {
      window.ddListener.push(['on', 'change:listing.items.length', (newValue, previousValue) => {
        assert.ok(newValue === 3);
        assert.ok(previousValue === 2);
        done();
      }]);
      window.digitalData.listing.items.push({id: 3});
    });

    it('should fire change callbacks asynchronously, ignoring possible exceptions', (done) => {
      window.ddListener.push(['on', 'change', (newValue, previousValue) => {
        throw new Error('test error');
      }]);
      window.ddListener.push(['on', 'change', (newValue, previousValue) => {
        done();
      }]);
      window.digitalData.test2 = 'test2';
    });

    it('should handle change callback exception', (done) => {
      const errorHandler = (error) => {
        done();
      };

      //set custom callback for change handler result
      _eventManager.setEventHandlerResultCallback(errorHandler);

      window.ddListener.push(['on', 'change', (newValue, previousValue) => {
        throw new Error('test error');
      }]);
      window.digitalData.test2 = 'test2';
    });

    it('should NOT fire change callback', (done) => {
      window.ddListener.push(['on', 'change', () => {
        assert.ok(false);
        done();
      }]);
      setTimeout(() => {
        assert.ok(true);
        done();
      }, 101); //check interval is 100, so 101 will work

      window.digitalData.test = 'test';
    });

    it('should NOT fire change key callback', (done) => {
      window.ddListener.push(['on', 'change:user.returning', () => {
        assert.ok(false);
        done();
      }]);
      setTimeout(() => {
        assert.ok(true);
        done();
      }, 101); //check interval is 100, so 101 will work

      window.digitalData.user.returning = false;
    });

    it('should NOT fire change callback for array', (done) => {
      window.ddListener.push(['on', 'change:listing.items', () => {
        assert.ok(false);
        done();
      }]);
      setTimeout(() => {
        assert.ok(true);
        done();
      }, 101); //check interval is 100, so 101 will work

      window.digitalData.listing.items.pop();
      window.digitalData.listing.items.push({id: 2});
    });

    it('should NOT fire length change callback for array', (done) => {
      window.ddListener.push(['on', 'change:listing.items.length', () => {
        assert.ok(false);
        done();
      }]);
      setTimeout(() => {
        assert.ok(true);
        done();
      }, 101); //check interval is 100, so 101 will work

      window.digitalData.listing.items.pop();
      window.digitalData.listing.items.push({id: 3});
    });

    it('should NOT fire change callback if event was added', (done) => {
      window.ddListener.push(['on', 'change', () => {
        assert.ok(false);
        done();
      }]);
      setTimeout(() => {
        assert.ok(true);
        done();
      }, 101); //check interval is 100, so 101 will work

      window.digitalData.events.push({
        name: 'Test Event'
      });
    });

  });


});