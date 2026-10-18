package app.sali.vpn

import com.android.billingclient.api.*
import com.facebook.react.bridge.*

class SaliBillingModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), PurchasesUpdatedListener {
  private var purchasePromise: Promise? = null
  private val billingClient by lazy {
    BillingClient.newBuilder(context).setListener(this)
      .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
      .build()
  }

  override fun getName() = "SaliBilling"

  @ReactMethod
  fun purchaseSubscription(productId: String, promise: Promise) {
    val activity = currentActivity ?: return promise.reject("NO_ACTIVITY", "Google Play недоступен")
    purchasePromise = promise
    billingClient.startConnection(object : BillingClientStateListener {
      override fun onBillingServiceDisconnected() = reject("SERVICE_DISCONNECTED", "Соединение с Google Play потеряно")
      override fun onBillingSetupFinished(result: BillingResult) {
        if (result.responseCode != BillingClient.BillingResponseCode.OK) return reject("BILLING_UNAVAILABLE", result.debugMessage)
        val product = QueryProductDetailsParams.Product.newBuilder()
          .setProductId(productId).setProductType(BillingClient.ProductType.SUBS).build()
        billingClient.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build()) { queryResult, detailsResult ->
          val details = detailsResult.productDetailsList.firstOrNull()
          val offerToken = details?.subscriptionOfferDetails?.firstOrNull()?.offerToken
          if (queryResult.responseCode != BillingClient.BillingResponseCode.OK || details == null || offerToken == null) {
            return@queryProductDetailsAsync reject("PRODUCT_UNAVAILABLE", "Подписка не опубликована в Google Play")
          }
          val item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).setOfferToken(offerToken).build()
          val flowResult = billingClient.launchBillingFlow(activity, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(item)).build())
          if (flowResult.responseCode != BillingClient.BillingResponseCode.OK) reject("FLOW_FAILED", flowResult.debugMessage)
        }
      }
    })
  }

  override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
    if (result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) return reject("USER_CANCELED", "Оплата отменена")
    val purchase = purchases?.firstOrNull { it.purchaseState == Purchase.PurchaseState.PURCHASED }
      ?: return reject("PURCHASE_PENDING", result.debugMessage.ifBlank { "Платёж ещё не завершён" })
    val map = Arguments.createMap().apply {
      putString("purchaseToken", purchase.purchaseToken)
      putString("productId", purchase.products.firstOrNull())
      putString("orderId", purchase.orderId)
      putString("packageName", context.packageName)
    }
    purchasePromise?.resolve(map)
    purchasePromise = null
  }

  private fun reject(code: String, message: String) {
    purchasePromise?.reject(code, message)
    purchasePromise = null
  }
}
