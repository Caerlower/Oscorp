import type { Account, Asset, gtxn, uint64 } from '@algorandfoundation/algorand-typescript'
import {
  abimethod,
  arc4,
  assert,
  assertMatch,
  Global,
  GlobalState,
  itxn,
  Txn,
  Uint64,
} from '@algorandfoundation/algorand-typescript'

// One Oscorp autonomous company per deployed app instance.
export class Oscorp extends arc4.Contract {
  initialized = GlobalState<boolean>({ initialValue: false })
  oscorpName = GlobalState<string>()
  category = GlobalState<string>()
  metadataUri = GlobalState<string>()

  creator = GlobalState<Account>()
  investor = GlobalState<Account>()
  treasury = GlobalState<Account>()
  protocolTreasury = GlobalState<Account>()

  pulseAsset = GlobalState<Asset>()
  usdcAsset = GlobalState<Asset>()

  creatorShareBps = GlobalState<uint64>()
  investorShareBps = GlobalState<uint64>()
  treasuryShareBps = GlobalState<uint64>()
  launchpadFeeBps = GlobalState<uint64>()

  approvalThresholdUsdc = GlobalState<uint64>()
  gtmBudgetUsdc = GlobalState<uint64>()
  minPatronPulse = GlobalState<uint64>()

  @abimethod()
  createOscorp(
    oscorpName: string,
    category: string,
    metadataUri: string,
    creator: Account,
    investor: Account,
    treasury: Account,
    protocolTreasury: Account,
    usdcAsset: Asset,
    pulseUnitName: string,
    pulseAssetName: string,
    pulseTotal: uint64,
    pulseDecimals: uint64,
    creatorShareBps: uint64,
    investorShareBps: uint64,
    treasuryShareBps: uint64,
    launchpadFeeBps: uint64,
    approvalThresholdUsdc: uint64,
    gtmBudgetUsdc: uint64,
    minPatronPulse: uint64,
  ): uint64 {
    assert(!this.initialized.value, 'already initialized')
    assert(creatorShareBps + investorShareBps + treasuryShareBps === Uint64(10_000), 'invalid split bps')
    assert(launchpadFeeBps <= Uint64(2_000), 'launchpad fee too high')

    this.oscorpName.value = oscorpName
    this.category.value = category
    this.metadataUri.value = metadataUri

    this.creator.value = creator
    this.investor.value = investor
    this.treasury.value = treasury
    this.protocolTreasury.value = protocolTreasury
    this.usdcAsset.value = usdcAsset

    this.creatorShareBps.value = creatorShareBps
    this.investorShareBps.value = investorShareBps
    this.treasuryShareBps.value = treasuryShareBps
    this.launchpadFeeBps.value = launchpadFeeBps
    this.approvalThresholdUsdc.value = approvalThresholdUsdc
    this.gtmBudgetUsdc.value = gtmBudgetUsdc
    this.minPatronPulse.value = minPatronPulse

    const createdPulse = itxn
      .assetConfig({
        total: pulseTotal,
        decimals: pulseDecimals,
        defaultFrozen: false,
        unitName: pulseUnitName,
        assetName: pulseAssetName,
        manager: Global.currentApplicationAddress,
        reserve: Global.currentApplicationAddress,
        fee: Global.minTxnFee,
      })
      .submit().createdAsset

    this.pulseAsset.value = createdPulse
    this.initialized.value = true

    return createdPulse.id
  }

  @abimethod()
  updatePolicy(approvalThresholdUsdc: uint64, gtmBudgetUsdc: uint64, minPatronPulse: uint64): void {
    assert(Txn.sender === this.creator.value, 'only creator')
    this.approvalThresholdUsdc.value = approvalThresholdUsdc
    this.gtmBudgetUsdc.value = gtmBudgetUsdc
    this.minPatronPulse.value = minPatronPulse
  }

  // Group requirement: first txn must transfer configured USDC to app address.
  @abimethod()
  distributeRevenue(payment: gtxn.AssetTransferTxn): void {
    assert(this.initialized.value, 'not initialized')
    assertMatch(
      payment,
      {
        assetReceiver: Global.currentApplicationAddress,
        xferAsset: this.usdcAsset.value,
      },
      'invalid payment',
    )

    const gross: uint64 = payment.assetAmount
    const launchpadFee: uint64 = (gross * this.launchpadFeeBps.value) / Uint64(10_000)
    const net: uint64 = gross - launchpadFee
    const creatorAmount: uint64 = (net * this.creatorShareBps.value) / Uint64(10_000)
    const investorAmount: uint64 = (net * this.investorShareBps.value) / Uint64(10_000)
    const treasuryAmount: uint64 = net - creatorAmount - investorAmount

    if (launchpadFee > Uint64(0)) {
      itxn
        .assetTransfer({
          xferAsset: this.usdcAsset.value,
          assetReceiver: this.protocolTreasury.value,
          assetAmount: launchpadFee,
          fee: Global.minTxnFee,
        })
        .submit()
    }
    if (creatorAmount > Uint64(0)) {
      itxn
        .assetTransfer({
          xferAsset: this.usdcAsset.value,
          assetReceiver: this.creator.value,
          assetAmount: creatorAmount,
          fee: Global.minTxnFee,
        })
        .submit()
    }
    if (investorAmount > Uint64(0)) {
      itxn
        .assetTransfer({
          xferAsset: this.usdcAsset.value,
          assetReceiver: this.investor.value,
          assetAmount: investorAmount,
          fee: Global.minTxnFee,
        })
        .submit()
    }
    if (treasuryAmount > Uint64(0)) {
      itxn
        .assetTransfer({
          xferAsset: this.usdcAsset.value,
          assetReceiver: this.treasury.value,
          assetAmount: treasuryAmount,
          fee: Global.minTxnFee,
        })
        .submit()
    }
  }
}
