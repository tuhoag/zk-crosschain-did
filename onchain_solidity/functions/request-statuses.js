// Imports
const ethers = await import("npm:ethers@6.10.0")
const { Buffer } = await import("node:buffer")

const domain = args[0]
const lastDecodedStatus = args[1]
const lastStatusTime = args[2]
const statusType = args[3]
const statusMechanism = args[4]

console.log(`domain: ${domain}`)
console.log(`lastDecodedStatus: ${lastDecodedStatus}`)
console.log(`lastStatusTime: ${lastStatusTime}`)
console.log(`statusType: ${statusType}`)
console.log(`statusMechanism: ${statusMechanism}`)

let decodedLastStatus = BigInt(lastDecodedStatus)

let statusMechanismIndex
if (statusMechanism == 0) {
  statusMechanismIndex = "bsl"
} else if (statusMechanism == 1) {
  statusMechanismIndex = "mt"
} else {
  throw new Error(`Invalid status mechanism: ${statusMechanism}`)
}

let statusTypeIndex
if (statusType == 1) {
  statusTypeIndex = "issuance"
} else if (statusType == 2) {
  statusTypeIndex = "revocation"
} else {
  throw new Error(`Invalid status type: ${statusType}`)
}

// Use multiple APIs & aggregate the results to enhance decentralization
let urls = [
  `${domain}/statuses/${statusMechanismIndex}/${statusTypeIndex}?time=${lastStatusTime}`,
  // `${domain}/statuses/bsl/issuance?time=${lastStatusTime}`,
]

console.log(`urls: ${urls}`)

let requests = urls.map((url) => Functions.makeHttpRequest({ url: url }))
const responses = await Promise.all(requests)

let statuses = []
for (let i = 0; i < responses.length; i++) {
  let response = responses[i]
  let curStatuses = []

  if (response.error) {
    console.log("Error in calling API")
  } else {
    for (let j = 0; j < response.data.length; j++) {
      let status = response.data[j]
      status.decodedStatus = Buffer.from(status.status, "base64").readBigInt64BE(0)
      curStatuses.push(status)
    }

    curStatuses.sort((a) => a.time)
  }

  statuses.push(curStatuses)
}

const parser = (key, value) => {
  if (typeof value === "bigint") {
    return value.toString()
  }

  return value
}

console.log(`num of statuses: ${statuses.length}`)
if (statuses.length == 0) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abiCoder.encode(["uint64", "string"], [0, ""])
  const bytes = ethers.getBytes(encoded)
  console.log(`returned ${bytes.length} bytes`)
  return bytes
} else {
  console.log(`collected statuses: ${JSON.stringify(statuses, parser)}`)
  let validStatuses = []
  for (let i = 0; i < statuses.length; i++) {
    let curValidStatuses = []
    let curStatuses = statuses[i]
    let preDecodedStatus = decodedLastStatus

    for (let j = 0; j < curStatuses.length; j++) {
      let status = curStatuses[j]
      console.log(`checking status: preDecodedStatus: ${preDecodedStatus}, status: ${status.decodedStatus}`)

      if ((status.decodedStatus & preDecodedStatus) !== preDecodedStatus) {
        console.log(`invalid status: preDecodedStatus: ${preDecodedStatus}, status: ${status.decodedStatus}`)
        curValidStatuses = []
        break
      }

      preDecodedStatus = status.decodedStatus
      curValidStatuses.push(status)
    }

    validStatuses.push(curValidStatuses)
  }

  console.log(`num of valid statuses: ${validStatuses.length}`)
  console.log(`valid statuses: ${JSON.stringify(validStatuses, parser)}`)

  let maxLen = 0
  let maxIndex = -1
  for (let i = 0; i < validStatuses.length; i++) {
    if (validStatuses[i].length >= maxLen) {
      maxIndex = i
      maxLen = validStatuses[i].length
    }
  }

  console.log(`maxLen: ${maxLen}`)
  console.log(`maxIndex: ${maxIndex}`)

  // ABI encoding
  console.log(validStatuses[maxIndex][maxLen - 1])
  const { time, status_mechanism, status_type, decodedStatus } = validStatuses[maxIndex][maxLen - 1]

  let status_mechanism_index = 0
  if (status_mechanism == "bsl") {
    status_mechanism_index = 0
  } else if (status_mechanism == "mt") {
    status_mechanism_index = 1
  }

  let status_type_index = 0
  if (status_type == "issuance") {
    status_type_index = 1
  } else if (status_type == "revocation") {
    status_type_index = 2
  } else {
    status_type_index = 0
  }

  const abiCoder = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abiCoder.encode(["uint64", "uint64"], [time, decodedStatus])
  const bytes = ethers.getBytes(encoded)
  console.log(`returned ${bytes.length} bytes`)
  return bytes
}
