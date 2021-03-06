import Integration from './../Integration';
import { getProp } from 'driveback-utils/dotProp';
import {
  VIEWED_PRODUCT_DETAIL,
  VIEWED_PRODUCT_LISTING,
  ADDED_PRODUCT,
  REMOVED_PRODUCT,
  COMPLETED_TRANSACTION,
  SEARCHED_PRODUCTS,
} from './../events/semanticEvents';

const SEMANTIC_EVENTS = [
  VIEWED_PRODUCT_DETAIL,
  VIEWED_PRODUCT_LISTING,
  ADDED_PRODUCT,
  REMOVED_PRODUCT,
  COMPLETED_TRANSACTION,
  SEARCHED_PRODUCTS,
];

class REES46 extends Integration {
  constructor(digitalData, options) {
    const optionsWithDefaults = Object.assign({
      storeKey: '',
      feedWithGroupedProducts: false,
    }, options);

    super(digitalData, optionsWithDefaults);

    this.addTag({
      type: 'script',
      attr: {
        src: 'https://cdn.rees46.com/v3.js',
      },
    });
  }

  initialize() {
    window.r46 = window.r46 || function r46Init() {
      (window.r46.q = window.r46.q || []).push(arguments);
    };
    window.r46('init', this.getOption('storeKey'));
  }

  getSemanticEvents() {
    return SEMANTIC_EVENTS;
  }

  getEnrichableEventProps(event) {
    if (event.name === VIEWED_PRODUCT_DETAIL) {
      return ['product'];
    } else if (event.name === VIEWED_PRODUCT_LISTING) {
      return ['listing.categoryId'];
    } else if (event.name === SEARCHED_PRODUCTS) {
      return ['listing.query'];
    } else if (event.name === COMPLETED_TRANSACTION) {
      return ['transaction'];
    }
    return [];
  }

  trackEvent(event) {
    const eventMap = {
      [VIEWED_PRODUCT_DETAIL]: this.onViewedProductDetail.bind(this),
      [VIEWED_PRODUCT_LISTING]: this.onViewedProductListing.bind(this),
      [SEARCHED_PRODUCTS]: this.onSearchedProducts.bind(this),
      [ADDED_PRODUCT]: this.onAddedProduct.bind(this),
      [REMOVED_PRODUCT]: this.onRemovedProduct.bind(this),
      [COMPLETED_TRANSACTION]: this.onCompletedTransaction.bind(this),
    };
    if (eventMap[event.name]) {
      eventMap[event.name](event);
    }
  }

  onViewedProductDetail(event) {
    const product = event.product || {};
    const feedWithGroupedProducts = this.getOption('feedWithGroupedProducts');
    const productId = (feedWithGroupedProducts) ? product.skuCode : product.id;
    if (productId) {
      const stock = product.stock;
      if (stock !== undefined) {
        window.r46('track', 'view', {
          id: productId,
          stock: (stock > 0),
        });
      } else {
        window.r46('track', 'view', productId);
      }
    }
  }

  onAddedProduct(event) {
    const product = event.product || {};
    const feedWithGroupedProducts = this.getOption('feedWithGroupedProducts');
    const productId = (feedWithGroupedProducts) ? product.skuCode : product.id;
    if (productId) {
      window.r46('track', 'cart', {
        id: productId,
        amount: event.quantity || 1,
      });
    }
  }

  onRemovedProduct(event) {
    const product = event.product || {};
    const feedWithGroupedProducts = this.getOption('feedWithGroupedProducts');
    const productId = (feedWithGroupedProducts) ? product.skuCode : product.id;
    if (productId) {
      window.r46('track', 'remove_from_cart', productId);
    }
  }

  onViewedProductListing(event) {
    const listing = event.listing || {};
    const categoryId = listing.categoryId;
    if (categoryId) {
      window.r46('track', 'category', categoryId);
    }
  }

  onSearchedProducts(event) {
    const listing = event.listing || {};
    const query = listing.query;
    if (query) {
      window.r46('track', 'search', query);
    }
  }

  onCompletedTransaction(event) {
    const transaction = event.transaction || {};
    const lineItems = transaction.lineItems || [];
    const feedWithGroupedProducts = this.getOption('feedWithGroupedProducts');
    if (lineItems.length) {
      window.r46('track', 'purchase', {
        products: lineItems.map(lineItem => ({
          id: (feedWithGroupedProducts)
            ? getProp(lineItem, 'product.skuCode') : getProp(lineItem, 'product.id'),
          price: getProp(lineItem, 'product.unitSalePrice'),
          amount: lineItem.quantity || 1,
        })),
        order: transaction.orderId,
        order_price: transaction.total,
      });
    }
  }
}

export default REES46;
