import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { OscorpFactory } from '../artifacts/oscorp/OscorpClient'

export async function deploy() {
  console.log('=== Deploying Oscorp ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(OscorpFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({ onUpdate: 'append', onSchemaBreak: 'append' })

  // App requires min balance for ASA creation and inner transfers.
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (2).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
    console.log(`Funded app ${appClient.appClient.appId} for bootstrap operations`)
  } else {
    console.log(`Reused app ${appClient.appClient.appId}`)
  }
}
