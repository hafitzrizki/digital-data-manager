import Integration from './../Integration';
import deleteProperty from './../functions/deleteProperty';
import cleanObject from './../functions/cleanObject';
import getQueryParam from './../functions/getQueryParam';
import topDomain from './../functions/topDomain';
import { getProp } from './../functions/dotProp';
import { COMPLETED_TRANSACTION, LEAD } from './../events';
import cookie from 'js-cookie';

function getScreenResolution() {
  return `${window.screen.width}x${window.screen.height}`;
}

const PAYMENT_TYPE_SALE = 'sale';
const PAYMENT_TYPE_LEAD = 'lead';
const UID_GET_PARAM = 'admitad_uid';
const DEFAULT_COOKIE_NAME = 'admitad_uid';

function normalizeOptions(options) {
  if (options.deduplication) {
    if (options.utmSource) {
      options.utmSource = options.utmSource.toLowerCase();
    }
    if (options.deduplicationUtmMedium) {
      options.deduplicationUtmMedium = options.deduplicationUtmMedium.map((utmMedium) => {
        return utmMedium.toLowerCase();
      });
    }
  }
}

class Admitad extends Integration {

  constructor(digitalData, options) {
    normalizeOptions(options);
    const optionsWithDefaults = Object.assign({
      campaignCode: '',
      paymentType: PAYMENT_TYPE_SALE,
      defaultActionCode: '1',
      responseType: 'img',
      cookieName: DEFAULT_COOKIE_NAME,
      cookieTracking: true, // false - if advertiser wants to track cookies by itself
      cookieDomain: topDomain(window.location.href),
      cookieTtl: 90, // days
      deduplication: false,
      utmSource: 'admitad', // utm_source which is sent with admitad_uid get param
      deduplicationUtmMedium: ['affiliate'], // by default deduplicate only with other affiliates
    }, options);

    super(digitalData, optionsWithDefaults);

    this._isLoaded = false;

    this.addTag('trackingPixel', {
      type: 'script',
      attr: {
        id: '_admitad-pixel',
        src: `//cdn.asbmit.com/static/js/ad/pixel.min.js?r=${Date.now()}`,
      },
    });
  }

  initialize() {
    this._isLoaded = true;

    if (this.getOption('cookieTracking')) {
      this.addAffiliateCookie();
    }

    this.onLoad();
  }

  addAffiliateCookie() {
    if (window.self !== window.top) {
      return; // protect from iframe cookie-stuffing
    }

    const uidInQuery = getQueryParam(UID_GET_PARAM);
    if (uidInQuery) {
      cookie.set(this.getOption('cookieName'), uidInQuery, {
        expires: this.getOption('cookieTtl'),
        domain: this.getOption('cookieDomain'),
      });
    }
  }

  getEnrichableEventProps(event) {
    let enrichableProps = [];

    if (event.name === COMPLETED_TRANSACTION) {
      enrichableProps = [
        'transaction',
        'user.userId',
        'website.currency',
        'context.campaign',
      ];
    } else if (event.name === LEAD) {
      enrichableProps = [
        'user.userId',
        'context.campaign',
      ];
    }

    return enrichableProps;
  }

  isLoaded() {
    return this._isLoaded;
  }

  reset() {
    deleteProperty(window, '_admitadPixel');
    deleteProperty(window, '_admitadPositions');
  }

  trackEvent(event) {
    const uid = cookie.get(this.getOption('cookieName'));
    if (!uid) return;

    if (this.isDeduplication(event)) return;

    if (event.name === COMPLETED_TRANSACTION && this.getOption('paymentType') === PAYMENT_TYPE_SALE) {
      this.trackSale(event, uid);
    } else if (event.name === LEAD && this.getOption('paymentType') === PAYMENT_TYPE_LEAD) {
      this.trackLead(event, uid);
    }
  }

  isDeduplication(event) {
    if (this.getOption('deduplication')) {
      const campaignSource = getProp(event, 'context.campaign.source');
      if (campaignSource && campaignSource.toLowerCase() !== this.getOption('campaignSource')) {
        // last click source is not admitad
        const deduplicationUtmMedium = this.getOption('deduplicationUtmMedium') || [];
        const campaignMedium = getProp(event, 'context.campaign.medium');
        if (deduplicationUtmMedium.indexOf(campaignMedium.toLowerCase() >= 0)) {
          // last click medium is deduplicated
          return true;
        }
      }
    }
    return false;
  }

  setupPixel(event) {
    window._admitadPixel = {
      response_type: this.getOption('responseType'),
      action_code: getProp(event, 'admitad.actionCode') || this.getOption('defaultActionCode'),
      campaign_code: this.getOption('campaignCode'),
    };
    window._admitadPositions = window._admitadPositions || [];
  }

  trackSale(event, uid) {
    const transaction = event.transaction;

    if (!transaction || !transaction.lineItems || !transaction.lineItems.length) {
      return;
    }

    this.setupPixel(event);

    const lineItems = transaction.lineItems;
    let index = 1;
    for (const lineItem of lineItems) {
      window._admitadPositions.push(cleanObject({
        uid: uid,
        order_id: transaction.orderId,
        position_id: index,
        client_id: getProp(event, 'user.userId'),
        tariff_code: getProp(lineItem, 'admitad.tariffCode') || '1',
        currency_code: getProp(lineItem, 'product.currency') || getProp(event, 'website.currency'),
        position_count: lineItems.length,
        price: getProp(lineItem, 'product.unitSalePrice') || getProp(lineItem, 'product.unitPrice'),
        quantity: lineItem.quantity || 1,
        product_id: getProp(lineItem, 'product.id'),
        screen: getScreenResolution(),
        old_customer: (transaction.isFirst === false) ? 1 : 0,
        coupon: (transaction.vouchers && transaction.vouchers.length) ? 1 : 0,
        payment_type: PAYMENT_TYPE_SALE,
      }));
      index += 1;
    }

    this.load('trackingPixel');
  }

  trackLead(event, uid) {
    if (!event.lead || !event.lead.id) {
      return;
    }

    this.setupPixel(event);

    window._admitadPositions.push(cleanObject({
      uid: uid,
      order_id: getProp(event, 'lead.id'),
      client_id: getProp(event, 'user.userId'),
      tariff_code: getProp(event, 'admitad.tariffCode') || '1',
      screen: getScreenResolution(),
      payment_type: PAYMENT_TYPE_LEAD,
    }));

    this.load('trackingPixel');
  }
}

export default Admitad;
