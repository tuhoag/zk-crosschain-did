// Imports
const ethers = await import("npm:ethers@6.10.0")
const { Buffer } = await import("node:buffer")

const domain = args[0]
const statusType = args[1]
const statusMechanism = args[2]
const dataSize = 7;

console.log(`domain: ${domain}`)
console.log(`statusType: ${statusType}`)
console.log(`statusMechanism: ${statusMechanism}`)

const lastStatus = bytesArgs[0]

const abiCoder = ethers.AbiCoder.defaultAbiCoder()

let encodedData = ""

if (statusMechanism == 0) {
  // bsl
  const decodedData = abiCoder.decode(["uint64", `uint64`], lastStatus)
  const lastTime = decodedData[0]
  const newTime = lastTime + BigInt(1)
  const lastData = decodedData[1]
  let newData = lastData;

  for (let i = 0; i < 64; i++) {
    if ((newData >> BigInt(j)) & BigInt(1) === BigInt(0)) {
      newData = newData | (BigInt(1) << BigInt(i))
      break
    }
  }

  encodedData = abiCoder.encode(
    ["uint64", "uint64"],
    [newTime, newData]
  );
} else if (statusMechanism == 2) {
  const decodedData = abiCoder.decode(["uint32", `uint256[${dataSize}]`], lastStatus)
  const lastTime = decodedData[0]
  const lastData = decodedData[1]

  const newTime = lastTime + BigInt(1)
  let newData = []
  let isFinished = false
  for (let i = 0; i < dataSize; i++) {
    let part = lastData[i]
    if (!isFinished) {
      for (let j = 0; j < 256; j++) {
        if (((lastData[i] >> BigInt(j)) & BigInt(1)) === BigInt(0)) {
          part = part | (BigInt(1) << (BigInt(j)))
          isFinished = true
          break
        }
      }
    }

    newData.push(part);
  }

  // console.log(newData)
  encodedData = abiCoder.encode(
    ["uint32", `uint256[${dataSize}]`],
    [newTime, newData]
  );
} else {
  throw new Error("invalid status mechanism")
}

// console.log(`encodedData: ${encodedData.length}`)
console.log(encodedData)
const bytes = ethers.getBytes(encodedData)
console.log(`returned ${bytes.length} bytes`)
return bytes