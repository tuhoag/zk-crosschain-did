const { SubscriptionManager } = require("@chainlink/functions-toolkit")
const { networks } = require("../../networks")

task(
  "functions-sub-info",
  "Gets the Functions billing subscription balance, owner, and list of authorized consumer contract addresses"
)
  .addParam("subid", "Subscription ID")
  .addParam("log", "Log the subscription info", true, types.boolean)
  .setAction(async (taskArgs) => {
    const subscriptionId = parseInt(taskArgs.subid)
    const log = taskArgs.log

    const signer = await ethers.getSigner()
    const linkTokenAddress = networks[network.name]["linkToken"]
    const functionsRouterAddress = networks[network.name]["functionsRouter"]

    const sm = new SubscriptionManager({ signer, linkTokenAddress, functionsRouterAddress })
    await sm.initialize()

    const subInfo = await sm.getSubscriptionInfo(subscriptionId)
    // parse balances into LINK for readability
    subInfo.formattedBalance = ethers.utils.formatEther(subInfo.balance)
    subInfo.balanceStr = ethers.utils.formatEther(subInfo.balance) + " LINK"
    subInfo.blockedBalance = ethers.utils.formatEther(subInfo.blockedBalance) + " LINK"

    if (log) {
      console.log(`\nInfo for subscription ${subscriptionId}:\n`, subInfo)
    }

    return subInfo
  })
