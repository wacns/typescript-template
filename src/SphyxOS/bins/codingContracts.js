import { getCType, getCData, getServersLight, cctAttempt } from "SphyxOS/util.js"
let working = []

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  if (!globalThis["SphyxOSCCTWebWorkers"]) globalThis["SphyxOSCCTWebWorkers"] = []
  await ns.sleep(100)
  ns.atExit(() => {
    while (working.length) {
      let worker = working.pop()
      if (!globalThis["SphyxOSCCTWebWorkers"].includes(worker)) { //Just check for a dirty version.  If it's clean it won't be in here
        globalThis["SphyxOSCCTWebWorkers"].push(worker)
      }
      worker = null
    }
    ns.writePort(ns.pid, true)
  })
  //ns.args:  0 is server  1 is script name
  const servers = ns.args.includes("darknet") ? [ns.args[0]] : await getServersLight(ns)
  //[server, file, type] entries
  const contracts = []
  const failures = []
  const ready = []
  let inFlight = 0
  let count = 0
  let failed = 0
  let unsolved = 0
  if (!ns.args.includes("quiet")) ns.ui.openTail()
  let tm = performance.now()
  for (const server of servers) {
    for (const file of ns.ls(server).filter(f => f.includes(".cct"))) {
      const type = await getCType(ns, file, server)
      contracts.push([server, file, type])
      if (performance.now() - tm >= 200) {
        ns.clearLog()
        ns.printRaw("Finding contracts.  At: " + contracts.length)
        ns.ui.renderTail()
        await ns.sleep(0)
      }
    }
  }
  ns.clearLog()
  ns.printRaw("Contracts total: " + contracts.length)
  ns.ui.renderTail()
  for (const contract of contracts) {
    let worker = await getWorker(ns)
    inFlight++
    worker.onmessage = (msg) => {
      ready.push(msg)
      globalThis["SphyxOSCCTWebWorkers"].push({ workerReady: worker })
      working = working.filter(w => w !== worker)
      worker = null
    }
    const data = await getCData(ns, contract[1], contract[0])
    const entryPoint = typeEntryPoints.get(contract[2]);
    if (!entryPoint) {
      unsolved++
      inFlight--
      continue
    }
    worker.postMessage([entryPoint, data, contract[1], contract[0]])
    working.push(worker)
    if (inFlight - count > 50) {
      ns.clearLog()
      ns.printRaw("Contracts total: " + contracts.length)
      ns.printRaw("Processed      : " + inFlight)
      ns.ui.renderTail()
      await ns.asleep(4)
    }
    else if (!globalThis["SphyxOSCCTWebWorkers"].length) {
      ns.clearLog()
      ns.printRaw("Contracts total: " + contracts.length)
      ns.printRaw("Processed      : " + inFlight)
      ns.ui.renderTail()
      await ns.asleep(0)
    }
  }
  while (inFlight > count) {
    while (ready.length > 0) {
      const msg = ready.pop()
      try { ns.ls(msg.data[2]) } //Is the server still there?
      catch {
        failed++
        count++
        continue
      }
      if (msg.data[0] == null) unsolved++  //We had an entry point, but something failed in the solver        
      else {
        const reward = await cctAttempt(ns, msg.data[0], msg.data[1], msg.data[2])
        if (!reward) {
          failures.push(ns.sprintf("Failed: %s", msg.data[3]))
          failed++
        }
        else {
          //Todo:  Tally up all the rewards and print them at the bottom
        }
      }
      count++
    }
    ns.clearLog()
    ns.printRaw("Contracts total: " + contracts.length)
    ns.printRaw("Processed      : " + inFlight)
    ns.printRaw("Solved         : " + count)
    ns.ui.renderTail()
    await ns.asleep(4)
  }
  if (!ns.args.includes("quiet")) {
    ns.printRaw("Solved: " + (count - failed))
    ns.printRaw("Failed: " + failed)
    ns.printRaw("Unsolved: " + unsolved)
    ns.printRaw("Workers : " + globalThis["SphyxOSCCTWebWorkers"].length)
    if (failures.length) {
      ns.printRaw("Failures:")
      ns.printRaw(failures.join("\n"))
    }
  }
}
const isWorker = (w) => !!w && typeof w.postMessage === "function"
async function getWorker(ns) {
  while (globalThis["SphyxOSCCTWebWorkers"].length) {
    const entry = globalThis["SphyxOSCCTWebWorkers"].shift()
    const worker = isWorker(entry?.workerReady) ? entry.workerReady : entry
    if (!isWorker(worker)) continue          // skip/discard garbage from older runs
    if (entry?.workerReady) return worker    // already reset & ready
    return new Promise((resolve) => {
      worker.onmessage = (event) => {
        if (event.data?.type === "reset-complete") resolve(worker)
      }
      worker.postMessage({ type: "reset" })
    })
  }
  const workerURL = URL.createObjectURL(blob)
  const worker = new Worker(workerURL)
  URL.revokeObjectURL(workerURL)
  return worker
}


const types = [
  ["Algorithmic Stock Trader I", "stonks1"],
  ["Algorithmic Stock Trader II", "stonks2"],
  ["Algorithmic Stock Trader III", "stonks3"],
  ["Algorithmic Stock Trader IV", "stonks4"],
  ["Array Jumping Game", "arrayjumpinggame"],
  ["Array Jumping Game II", "arrayjumpinggameII"],
  ["Square Root", "bigIntSquareRoot"],
  ["Compression I: RLE Compression", "rlecompression"],
  ["Compression II: LZ Decompression", "lzdecompression"],
  ["Compression III: LZ Compression", "lzcompression"],
  ["Encryption I: Caesar Cipher", "caesarcipher"],
  ["Encryption II: Vigenère Cipher", "vigenere"],
  ["Find All Valid Math Expressions", "fcnFindAllValidMathExpressions"],
  ["Find Largest Prime Factor", "largestprimefactor"],
  ["Generate IP Addresses", "generateips"],
  ["HammingCodes: Encoded Binary to Integer", "hammingdecode"],
  ["HammingCodes: Integer to Encoded Binary", "hammingencode"],
  ["Largest Rectangle in a Matrix", "largestrectangleinmatrix"],
  ["Merge Overlapping Intervals", "mergeoverlappingintervals"],
  ["Minimum Path Sum in a Triangle", "minpathsum"],
  ["Proper 2-Coloring of a Graph", "twocolor"],
  ["Sanitize Parentheses in Expression", "sanitizeparentheses"],
  ["Shortest Path in a Grid", "shortestpathinagrid"],
  ["Spiralize Matrix", "spiralizematrix"],
  ["Subarray with Maximum Sum", "subarraywithmaximumsum"],
  ["Total Ways to Sum", "totalwaystosum"],
  ["Total Ways to Sum II", "totalwaystosumII"],
  ["Unique Paths in a Grid I", "uniquepathsI"],
  ["Unique Paths in a Grid II", "uniquepathsII"],
  ["Total Number of Primes", "totalPrimes"]
];
const typeEntryPoints = new Map(types);

const workerCode = `
function minpathsum(data) {
	while (data.length > 1) {
		for (let i = 0; i < (data[data.length - 2]).length; i++) {
			data[data.length - 2][i] += Math.min(data[data.length - 1][i], Math.min(data[data.length - 1][i + 1]));
		}
		data.pop();
	}
	return data[0][0];
}
function uniquepathsI(data) {
	let numbers = []
	for (let i = 0; i < data[0]; i++) {
		numbers.push([]);
		for (let j = 0; j < data[1]; j++) {
			numbers[numbers.length - 1].push(1);
			if (i > 0 && j != 0) {
				numbers[i][j] = numbers[i - 1][j] + numbers[i][j - 1];
			}
		}
	}
	return numbers[data[0] - 1][data[1] - 1];
}
function uniquepathsII(data) {
	let answer = [];
	for (let i = 0; i < data.length; i++) {
		answer.push(new Array(data[0].length).fill(0));
	}
	for (let i = data.length - 1; i >= 0; i--) {
		for (let j = data[0].length - 1; j >= 0; j--) {
			if (data[i][j] == 0) {
				answer[i][j] = (i + 1 < data.length ? answer[i + 1][j] : 0) + (j + 1 < data[0].length ? answer[i][j + 1] : 0);
				answer[data.length - 1][data[0].length - 1] = 1;
			}
		}
	}
	return answer[0][0];
}
function largestprimefactor(data) {
	let i = 2;
	while (data > 1) {
		while (data % i == 0) {
			data /= i;
		}
		i += 1;
	}
	return i - 1;
}
function mergeoverlappingintervals(data) {
	let intervals = (new Array(data.map(x => x[1]).reduce((a, b) => { return Math.max(a, b) }))).fill(0);
	for (let interval of data) {
		for (let i = interval[0]; i < interval[1]; i++) {
			intervals[i] = 1;
		}
	}
	if (intervals.indexOf(1) == -1) {
		return [];
	}
	let answer = [[intervals.indexOf(1), intervals.indexOf(0, intervals.indexOf(1))]];
	while ((answer[answer.length - 1][0] != -1) && (answer[answer.length - 1][1] != -1)) {
		let a = intervals.indexOf(1, 1 + answer[answer.length - 1][1]);
		answer.push([a, intervals.indexOf(0, a)]);
	}
	if (answer[answer.length - 1][1] == -1) {
		answer[answer.length - 1][1] = intervals.length;
	}
	if (answer[answer.length - 1][0] == -1) {
		answer.pop();
	}
	return answer;
}
function caesarcipher(data) {
	return data[0].split("").map(x => { return x === " " ? " " : "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(("ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(x) + 26 - data[1]) % 26)] }).join("");
	// return data[0].split("").map(x => x.charCodeAt(0)).map(x => x == 32 ? 32 : (x + 65 - data[1])%26 + 65).map(x => String.fromCharCode(x)).join("");
}
function vigenere(data) {
	return data[0].split("").map((x, i) => { return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(("ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(x) + 13 + data[1].charCodeAt(i % data[1].length))) % 26] }).join("");
}
function totalwaystosum(data) {
	let answer = [1].concat((new Array(data + 1)).fill(0));
	for (let i = 1; i < data; i++) {
		for (let j = i; j <= data; j++) {
			answer[j] += answer[j - i];
		}
	}
	return answer[data];
}
function totalwaystosumII(data) {
	let answer = [1].concat((new Array(data[0])).fill(0));
	for (let i of data[1]) {
		for (let j = i; j <= data[0]; j++) {
			answer[j] += answer[j - i];
		}
	}
	return answer[data[0]];
}
function spiralizematrix(data) {
	let answer = [];
	while (data.length > 0 && data[0].length > 0) {
		answer = answer.concat(data.shift());
		if (data.length > 0 && data[0].length > 0) {
			answer = answer.concat(data.map(x => x.pop()));
			if (data.length > 0 && data[0].length > 0) {
				answer = answer.concat(data.pop().reverse());
				if (data.length > 0 && data[0].length > 0) {
					answer = answer.concat(data.map(x => x.shift()).reverse());
				}
			}
		}
	}
	return answer;
}
function subarraywithmaximumsum(data) {
	let answer = -1e308;
	for (let i = 0; i < data.length; i++) {
		for (let j = i; j < data.length; j++) {
			answer = Math.max(answer, data.slice(i, j + 1).reduce((a, b) => { return a + b }));
		}
	}
	return answer;
}
function twocolor(data) {
	for (let i = 0; i < 2 ** data[0]; i++) {
		let answer = [];
		for (let j = 0; j < data[0]; j++) {
			answer[j] = (2 ** j & i) > 0 ? 1 : 0;
		}
		if (data[1].map(x => answer[x[0]] != answer[x[1]]).reduce((a, b) => { return a + b }) == data[1].length) {
			return answer;
		}
	}
	return [];
}
function rlecompression(data) {
	let answer = "";
	data = data.split("");
	while (data.length > 0) {
		let z = data.splice(0, 1);
		let i = 1;
		while (i < 9 && data[0] == z & data.length > 0) {
			i += 1;
			data.splice(0, 1);
		}
		answer = answer.concat(i.toString()).concat(z);
	}
	return answer;
}
function lzdecompression(data) {
	if (data.length == 0) {
		return "";
	}
	data = data.split("");
	let answer = "";
	while (data.length > 0) {
		let chunklength = parseInt(data.shift());
		if (chunklength > 0) {
			answer = answer.concat(data.splice(0, chunklength).join(""));
		}
		if (data.length > 0) {
			chunklength = parseInt(data.shift());
			if (chunklength != 0) {
				let rewind = parseInt(data.shift());
				for (let i = 0; i < chunklength; i++) {
					answer = answer.concat(answer[answer.length - rewind]);
				}
			}
		}
	}
	return answer;
}
function lzcompression(str) {
	// state [i][j] contains a backreference of offset i and length j
	let cur_state = Array.from(Array(10), _ => Array(10)), new_state, tmp_state, result;
	cur_state[0][1] = ''; // initial state is a literal of length 1
	for (let i = 1; i < str.length; i++) {
		new_state = Array.from(Array(10), _ => Array(10));
		const c = str[i];
		// handle literals
		for (let len = 1; len <= 9; len++) {
			const input = cur_state[0][len];
			if (input === undefined) continue;
			if (len < 9) set(new_state, 0, len + 1, input); // extend current literal
			else set(new_state, 0, 1, input + '9' + str.substring(i - 9, i) + '0'); // start new literal
			for (let offset = 1; offset <= Math.min(9, i); offset++) { // start new backreference
				if (str[i - offset] === c) set(new_state, offset, 1, input + len + str.substring(i - len, i));
			}
		}
		// handle backreferences
		for (let offset = 1; offset <= 9; offset++) {
			for (let len = 1; len <= 9; len++) {
				const input = cur_state[offset][len];
				if (input === undefined) continue;
				if (str[i - offset] === c) {
					if (len < 9) set(new_state, offset, len + 1, input); // extend current backreference
					else set(new_state, offset, 1, input + '9' + offset + '0'); // start new backreference
				}
				set(new_state, 0, 1, input + len + offset); // start new literal
				// end current backreference and start new backreference
				for (let new_offset = 1; new_offset <= Math.min(9, i); new_offset++) {
					if (str[i - new_offset] === c) set(new_state, new_offset, 1, input + len + offset + '0');
				}
			}
		}
		tmp_state = new_state;
		new_state = cur_state;
		cur_state = tmp_state;
	}
	for (let len = 1; len <= 9; len++) {
		let input = cur_state[0][len];
		if (input === undefined) continue;
		input += len + str.substring(str.length - len, str.length);
		// noinspection JSUnusedAssignment
		if (result === undefined || input.length < result.length) result = input;
	}
	for (let offset = 1; offset <= 9; offset++) {
		for (let len = 1; len <= 9; len++) {
			let input = cur_state[offset][len];
			if (input === undefined) continue;
			input += len + '' + offset;
			if (result === undefined || input.length < result.length) result = input;
		}
	}
	return result ?? '';
}
function stonks1(data) {
	let best = 0;
	for (let i = 0; i < data.length; i++) {
		for (let j = i + 1; j < data.length; j++) {
			best = Math.max(best, data[j] - data[i]);
		}
	}
	return best;
}
function set(state, i, j, str) {
	if (state[i][j] === undefined || str.length < state[i][j].length) state[i][j] = str;
}
function stonks2(data) {
	let best = 0;
	let queue = {};
	queue[JSON.stringify(data)] = 0;
	while (Object.keys(queue).length > 0) {
		let current = Object.keys(queue)[0];
		let value = queue[current];
		delete queue[current];
		let stonks = JSON.parse(current);
		for (let i = 0; i < stonks.length; i++) {
			for (let j = i + 1; j < stonks.length; j++) {
				best = Math.max(best, value + stonks[j] - stonks[i]);
				let remaining = stonks.slice(j + 1);
				if (remaining.length > 0) {
					if (!Object.keys(queue).includes(JSON.stringify(remaining))) {
						queue[JSON.stringify(remaining)] = -1e308;
					}
					queue[JSON.stringify(remaining)] = Math.max(queue[JSON.stringify(remaining)], value + stonks[j] - stonks[i]);
				}
			}
		}
	}
	return best;
}
function stonks3(data) {
	let best = 0;
	for (let i = 0; i < data.length; i++) {
		for (let j = i + 1; j < data.length; j++) {
			best = Math.max(best, data[j] - data[i]);
			for (let k = j + 1; k < data.length; k++) {
				for (let l = k + 1; l < data.length; l++) {
					best = Math.max(best, data[j] - data[i] + data[l] - data[k]);
				}
			}
		}
	}
	return best;
}
function stonks4(data) {
	let best = 0;
	let queue = {};
	queue[0] = {};
	queue[0][JSON.stringify(data[1])] = 0;
	for (let ii = 0; ii < data[0]; ii++) {
		queue[ii + 1] = {};
		while (Object.keys(queue[ii]).length > 0) {
			let current = Object.keys(queue[ii])[0];
			let value = queue[ii][current];
			delete queue[ii][current];
			let stonks = JSON.parse(current);
			for (let i = 0; i < stonks.length; i++) {
				for (let j = i + 1; j < stonks.length; j++) {
					best = Math.max(best, value + stonks[j] - stonks[i]);
					let remaining = stonks.slice(j + 1);
					if (remaining.length > 0) {
						if (!Object.keys(queue[ii + 1]).includes(JSON.stringify(remaining))) {
							queue[ii + 1][JSON.stringify(remaining)] = -1e308;
						}
						queue[ii + 1][JSON.stringify(remaining)] = Math.max(queue[ii + 1][JSON.stringify(remaining)], value + stonks[j] - stonks[i]);
					}
				}
			}
		}
	}
	return best;
}
function generateips(data) {
	let answer = [];
	for (let i = 1; i + 1 < data.length; i++) {
		for (let j = i + 1; j + 1 < data.length; j++) {
			for (let k = j + 1; k < data.length; k++) {
				answer.push([data.substring(0, i), data.substring(i, j), data.substring(j, k), data.substring(k)]);
			}
		}
	}
	for (let i = 0; i < 4; i++) {
		answer = answer.filter(x => 0 <= parseInt(x[i]) && parseInt(x[i]) <= 255 && (x[i] == "0" || x[i].substring(0, 1) != "0"));
	}
	return answer.map(x => x.join("."));
}
function arrayjumpinggame(data) {
	let queue = new Set();
	if (data[0] == 0) {
		return 0;
	}
	queue.add("[" + data.toString() + "]");
	while (queue.size > 0) {
		let current = Array.from(queue)[0];
		queue.delete(current);
		current = JSON.parse(current);
		if (current[0] != 0) {
			if (current[0] + 1 > current.length) {
				return 1;
			}
			for (let i = 1; i <= current[0] && i < current.length; i++) {
				queue.add(("[".concat(current.slice(i)).toString()).concat("]"));
			}
		}
	}
	return 0;
}
function arrayjumpinggameII(data) {
	let queue = {};
	let best = 1e308;
	queue[data.toString()] = 0;
	while (Object.keys(queue).length > 0) {
		let current = Object.keys(queue)[0];
		let value = queue[current];
		delete queue[current];
		current = current.split(",").map(i => parseInt(i));
		if (current[0] + 1 >= current.length) {
			best = Math.min(best, value + 1);
		} else {
			for (let i = 1; i <= current[0]; i++) {
				let newIndex = current.slice(i).toString();
				if (!Object.keys(queue).includes(newIndex)) queue[newIndex] = 1e308;
				queue[newIndex] = Math.min(queue[newIndex], value + 1);
			}
		}
	}
	return best == 1e308 ? 0 : best;
}
function hammingencode(data) {
  const enc = [0];
  const data_bits = data.toString(2).split("").reverse();

  data_bits.forEach((e, i, a) => {
    a[i] = parseInt(e);
  });

  let k = data_bits.length;

  for (let i = 1; k > 0; i++) {
    if ((i & (i - 1)) !== 0) {
      enc[i] = data_bits[--k];
    } else {
      enc[i] = 0;
    }
  }

  let parity = 0;

  /* Figure out the subsection parities */
  for (let i = 0; i < enc.length; i++) {
    if (enc[i]) {
      parity ^= i;
    }
  }

  parity = parity.toString(2).split("").reverse();
  parity.forEach((e, i, a) => {
    a[i] = parseInt(e);
  });

  /* Set the parity bits accordingly */
  for (let i = 0; i < parity.length; i++) {
    enc[2 ** i] = parity[i] ? 1 : 0;
  }

  parity = 0;
  /* Figure out the overall parity for the entire block */
  for (let i = 0; i < enc.length; i++) {
    if (enc[i]) {
      parity++;
    }
  }

  /* Finally set the overall parity bit */
  enc[0] = parity % 2 === 0 ? 0 : 1;

  return enc.join("");
}
function hammingdecode(data) {
	let powersoftwo = (new Array(Math.ceil(Math.log2(data)))).fill(0).map((_, i) => 2 ** i);
	let badbits = [];
	for (let i of powersoftwo.filter(x => x < data.length)) {
		let checksum = (new Array(data.length)).fill(0).map((_, i) => i).filter(x => x > i && (i & x)).map(x => parseInt(data.substring(x, x + 1))).reduce((a, b) => a ^ b);
		if (parseInt(data.substring(i, i + 1)) != checksum) {
			badbits.push(i);
		}
	}
	if (badbits.length == 0) { // No error in the data
		let checksum = data.substring(1).split("").map(x => parseInt(x)).reduce((a, b) => a ^ b);
		if (checksum == parseInt(data.substring(0, 1))) {
			let number = data.split("").map(x => parseInt(x));
			for (let i of powersoftwo.filter(x => x < data.length).reverse()) {
				number.splice(i, 1);
			}
			number.splice(0, 1);
			return number.reduce((a, b) => a * 2 + b);
		}
	}
	let badindex = badbits.reduce((a, b) => a | b, 0);
	return hammingdecode(data.substring(0, badindex).concat(data.substring(badindex, badindex + 1) == "0" ? "1" : "0").concat(data.substring(badindex + 1)));
}
function fcnFindAllValidMathExpressions(data)
{
  const digitsStr = data[0];
  const target = data[1];

  const digits = [];
  for (const digit of digitsStr)
  {
    digits.push(Number(digit));
  }

  return calcResults(digits, target);
}
function calcResults(digits, target, multiplier = 1, digitsLength = digits.length)
{
  const results = [];
  
  let numberSplit = 0;
  let numberSplitMultiplied = 0;
  let factorDigit = 1;
  let i = digitsLength - 1;
  while (i >= 0)
  {
    const newDigit = digits[i];
    if (newDigit != 0 || i == digitsLength - 1)
    {
      numberSplit = numberSplit + newDigit*factorDigit;
      numberSplitMultiplied = numberSplit*multiplier;

      if (i == 0 && numberSplitMultiplied == target)
      {
        results.push(numberSplit.toString());
        break;
      }

      let resultsSub = calcResults(digits, target - numberSplitMultiplied, 1, i);
      if (resultsSub.length != 0)
      {
        const endString = "+" + numberSplit.toString();
        resultsSub.forEach(resultSub => results.push(resultSub + endString));
      }

      if (numberSplitMultiplied != 0) resultsSub = calcResults(digits, target + numberSplitMultiplied, 1, i);
      if (resultsSub.length != 0)
      {
        const endString = "-" + numberSplit.toString();
        resultsSub.forEach(resultSub => results.push(resultSub + endString));
      }

      resultsSub = calcResults(digits, target, numberSplitMultiplied, i);
      if (resultsSub.length != 0)
      {
        const endString = "*" + numberSplit.toString();
        resultsSub.forEach(resultSub => results.push(resultSub + endString));
      }
    }

    factorDigit *= 10;
    --i;
  }
  return results;
}
function sanitizeparentheses(data) {
	let queue = new Set();
	queue.add(data);
	while (Array.from(queue).length > 0 && (Array.from(queue)[0].split("").includes("(") || Array.from(queue)[0].split("").includes(")"))) {
		let answer = [];
		let nextqueue = new Set();
		for (let current of Array.from(queue)) {
			let good = true;
			let goodsofar = 0;
			for (let i = 0; i < current.length; i++) {
				if (current.substring(i, i + 1) == "(") {
					goodsofar += 1;
				}
				if (current.substring(i, i + 1) == ")") {
					goodsofar -= 1;
				}
				if (goodsofar < 0) {
					good = false;
				}
			}
			if (goodsofar != 0) {
				good = false;
			}
			if (good) {
				answer.push(current);
			}
			for (let i = 0; i < current.length; i++) {
				if ("()".includes(current.substring(i, i + 1))) {
					nextqueue.add(current.substring(0, i).concat(current.substring(i + 1)));
				}
			}
		}
		if (answer.length > 0) {
			return answer;
		}
		queue = JSON.parse(JSON.stringify(Array.from(nextqueue)));
	}
	return [Array.from(queue)[0]];
}
function bigIntSquareRoot(input) {
  /* Sample description:
  You are given a ~200 digit BigInt. Find the square root of this number, to the nearest integer.
Hint: If you are having trouble, you might consult https://en.wikipedia.org/wiki/Methods_of_computing_square_roots

Input number:
155749932796205787079025839946442092616646565216212968193628150507722784379219739882976855229303236383313179875170603194170831690566247341307989070313945888007061855549721919178598301718356612610671431
   */

  // Yes, this could be inlined, but I was testing different algorithms, and it seems to work, so...
  return squareRootHeronsMethod(input).toString();
}
function squareRootHeronsMethod(input) {
  // Shouldn't be necessary; added during testing due to infinite loops with earlier designs
  const maxPasses = 400;
  let passes = 0;
  let x = 1n;

  // This SHOULD provide us with bounds if the root would be a decimal value
  while (!(x ** 2n <= input && (x + 1n) ** 2n > input)) {
    x = (x + (input / x)) / 2n;
    if (passes > maxPasses) {
      return -1n;
    }
    passes++;
  }

  // If it isn't a perfect square, check which value is closer
  if (absoluteValue(input - (x ** 2n)) > absoluteValue(input - ((x + 1n) ** 2n))) {
    x += 1n;
  }

  return x;
}
function absoluteValue(n) {
  if (n > 0n) {return n;}

  return 0n - n;
}
function shortestpathinagrid(data) {
	let solutions = { "0,0": "" };
	let queue = new Set();
	queue.add("0,0");
	for (let current of queue) {
		let x = parseInt(current.split(",")[0]);
		let y = parseInt(current.split(",")[1]);
		if (x > 0) {
			if (data[x - 1][y] == 0) {
				let key = (x - 1).toString().concat(",").concat(y.toString());
				if (!Array.from(queue).includes(key)) {
					solutions[key] = solutions[current] + "U";
					queue.add(key);
				}
			}
		}
		if (x + 1 < data.length) {
			if (data[x + 1][y] == 0) {
				let key = (x + 1).toString().concat(",").concat(y.toString());
				if (!Array.from(queue).includes(key)) {
					solutions[key] = solutions[current] + "D";
					queue.add(key);
				}
			}
		}
		if (y > 0) {
			if (data[x][y - 1] == 0) {
				let key = x.toString().concat(",").concat((y - 1).toString());
				if (!Array.from(queue).includes(key)) {
					solutions[key] = solutions[current] + "L";
					queue.add(key);
				}
			}
		}
		if (y + 1 < data[0].length) {
			if (data[x][y + 1] == 0) {
				let key = x.toString().concat(",").concat((y + 1).toString());
				if (!Array.from(queue).includes(key)) {
					solutions[key] = solutions[current] + "R";
					queue.add(key);
				}
			}
		}
	}
	let finalkey = (data.length - 1).toString().concat(",").concat((data[0].length - 1).toString());
	if (Object.keys(solutions).includes(finalkey)) {
		return solutions[finalkey];
	}
	return "";
}
function totalPrimes(n) {
  let low = n[0]
  let high = n[1]
  /** Modified Sieve of Eratosthenes to find primes across a range, rather than all primes below a value.*/
  //0 and 1 are not checked, so are removed here.
  if (low < 2) {
    low = 2;
  }
  let primes = 0;
  //Only store the potential primes in the low to high range instead of 0 to high.
  const arr = Array(high - low + 1);
  //In order to mark off all composite numbers, we need to run up through sqrt(high), since primes squares are the worst case.
  const checks = simpleSieve(Math.ceil(Math.sqrt(high)));
  for (const i of checks) {
    //same logic as for the simple sieve to mark off multiples of identified primes, but we only start checking at the first multiple>=low.
    const lim = Math.max(i, Math.ceil(low / i)) * i;
    for (let j = lim; j <= high; j += i) {
      arr[j - low] = 1;
    }
  }
  for (let a = 0; a <= high - low; a++) {
    if (!arr[a]) {
      //We don't really care what the value of the prime is, just how many we find.
      ++primes;
    }
  }
  return primes;
}
function simpleSieve(max) {
  const primes = [];
  //The array of numbers to check if they're prime is left blank. Blank and resulting prime values are falsey, non-primes are marked truthy.
  const arr = Array(max);
  //We only need to check factors up to the square root of max
  for (let i = 2; i * i <= max; i++) {
    //and only the prime factors
    if (!arr[i]) {
      //and we can then mark off all subsequent multiples of that prime
      for (let p = i * i; p <= max; p += i) {
        arr[p] = 1;
      }
    }
  }
  //It should be faster to loop over the array again than to check factors all the way to max and mark primes at the same time.
  for (let i = 2; i <= max; i++) {
    if (!arr[i]) {
      primes.push(i);
    }
  }
  return primes;
}
function largestrectangleinmatrix(data) {
  const histograms = Array.from({ length: data.length }, () => Array(data[0].length).fill(0));
  for (let i = 0; i < data[0].length; i++) {
    let count = 0;
    for (let j = 0; j < data.length; j++) {
      if (data[j][i] == 0) {
        count++;
      } else {
        count = 0;
      }
      histograms[j][i] = count;
    }
  }
  let maxArea = 0;
  let maxL = 0;
  let maxR = 0;
  let maxU = 0;
  let maxD = 0;
  for (let i = 0; i < histograms.length; i++) {
    const row = histograms[i];
    for (let j = 0; j < row.length; j++) {
      if (row[j] == 0) continue;
      let left = j;
      let right = j;
      // If the index is -1/row.length (out of bounds), it will return undefined. That's when comparing to a number
      // also returns false.
      while (row[left - 1] >= row[j]) {
        left--;
      }
      while (row[right + 1] >= row[j]) {
        right++;
      }
      if ((right - left + 1) * row[j] > maxArea) {
        maxArea = (right - left + 1) * row[j];
        maxL = left;
        maxR = right;
        maxU = i - row[j] + 1;
        maxD = i;
      }
    }
  }
  return [
    [maxU, maxL],
    [maxD, maxR],
  ];
}
const workerEntryPoints = Object.freeze({
${types.map(([, entryPoint]) => `  ${JSON.stringify(entryPoint)}: ${entryPoint}`).join(",\n")}
});

onmessage = (event) => {
  if (event.data?.type === "reset") {
    postMessage({ type: "reset-complete" });
    return;
  }

  const [entryPoint, payload, file, server] = Array.isArray(event.data) ? event.data : [];

  try {
    const handler = workerEntryPoints[entryPoint];

    if (typeof handler !== "function") {
      postMessage([null, file, server, entryPoint]);
      return;
    }

    postMessage([handler(payload), file, server, entryPoint]);
  } catch {
    console.log("Invalid entry point: " + entryPoint)
    postMessage([null, file, server, entryPoint]);
  }
};
`;
const blob = new Blob([workerCode], { type: "application/javascript" })