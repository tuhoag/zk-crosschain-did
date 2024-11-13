const { Buffer } = await import("node:buffer")

const lastStatus = args[0];
const lastStatusTime = args[1];
const decodedLastStatus = Buffer.from(lastStatus, 'base64').readBigInt64BE(0);

// Use multiple APIs & aggregate the results to enhance decentralization
let urls = [
    `http://localhost:3000/statuses/bsl/issuance?time=${lastStatusTime}`,
    `http://localhost:3000/statuses/bsl/issuance?time=${lastStatusTime}`,
];

let requests = urls.map(url => Functions.makeHttpRequest({url: url}));
const responses = await Promise.all(requests);

let statuses = [];
for (let i = 0; i < responses.length; i++) {
    let response = responses[i];
    let curStatuses = [];

    if (response.error) {
        console.log("Error in calling API");
    } else {
        for (let j = 0; j < response.data.length; j++) {
            let status = response.data[j];
            status.decodedStatus = Buffer.from(status.status, 'base64').readBigInt64BE(0);
            curStatuses.push(status);
        }

        curStatuses.sort(a => a.time);
    }

    statuses.push(curStatuses);
}

const parser = (key, value) => {
    if (typeof value === 'bigint') {
        return value.toString();
    }

    return value;
};

console.log(`collected statuses: ${JSON.stringify(statuses, parser)}`);

let validStatuses = [];
for (let i = 0; i < statuses.length; i++) {
    let curValidStatuses = [];
    let curStatuses = statuses[i];
    let preDecodedStatus = decodedLastStatus;

    for (let j = 0; j < curStatuses.length; j++) {
        let status = curStatuses[j];
        if ((status.decodedStatus & preDecodedStatus) !== preDecodedStatus) {
            curValidStatuses.clear();
            break;
        }

        curValidStatuses.push(status);
    }

    validStatuses.push(curValidStatuses);
}

console.log(`valid statuses: ${JSON.stringify(validStatuses, parser)}`);

let maxLen = 0;
let maxIndex = -1;
for (let i = 0; i < validStatuses.length; i++) {
    if (validStatuses[i].length >= maxLen) {
        maxIndex = i;
        maxLen = validStatuses[i].length;
    }
}

// return Functions.encodeString(statuses[statuses.length - 1].status)
return Functions.encodeString(validStatuses[maxIndex][maxLen - 1].status)