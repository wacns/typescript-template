/** @param {NS} ns */
export async function main(ns) {
  const terminal = [...globalThis["document"].querySelectorAll("#root > div > div > div > ul > div > div > div > div")]
  terminal.filter(e => e.textContent === "Terminal")[0]?.click()
  await ns.sleep(0)
  await terminal("run b1t_flum3.exe")
  await ns.sleep(0)
  const button = find(globalThis["document"], "//button[contains(text(), 'BitVerse')]")
  click(button)
}


//This will put something into the terminal and hit enter.  You however, need to be on the terminal to do it or it won't work.
async function terminal(text) {
  const slp = ms => new Promise(r => setTimeout(r, ms))
  function find(doc, xpath) { return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }
  function click(elem) {
    elem[Object.keys(elem)[1]].onClick({ isTrusted: true });
  }
  //Are we focused?
  const focused = find(globalThis["document"], "//button[contains(text(), 'Do something else simultaneously')]");
  if (focused) {
    click(focused)
    await slp(0)
  }
  //Capture the terminal button
  const terminalButton = [...globalThis["document"].querySelectorAll("#root > div > div > div > ul > div > div > div > div")]
  //Click it
  terminalButton.filter(e => e.textContent === "Terminal")[0]?.click()
  await slp(0)
  //Get the terminal input field
  const input = globalThis["document"].getElementById('terminal-input');
  //Get it's handler
  const handler = Object.keys(input)[1];
  //Set the change that will happen, ie: add it to the terminal
  input[handler].onChange({ target: { value: text } });
  //Click enter on the terminal
  input[handler].onKeyDown({ key: 'Enter', preventDefault: () => null });
}

function find(doc, xpath) { return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }

function click(elem) {
  elem[Object.keys(elem)[1]].onClick({ isTrusted: true });
}