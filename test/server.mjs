/* Fixture server: serves a miniature Broken Binding account area with the same
   DOM contract the plugin parses. Page 2 is delayed so a test can flip private
   mode mid-merge, and order 4 returns 500 so the failure path is visible. */
import http from "node:http";
const PORT = +(process.env.PORT || 4173);

const row = (id, iso, dateTxt, pay, ful, total) => `
  <tr class="customerAccount__row">
    <td><a href="/account/orders/${id}" aria-label="Order number #TBBSUB${id}">#TBBSUB${id}</a></td>
    <td><time datetime="${iso}">${dateTxt}</time></td>
    <td>${pay}</td>
    <td>${ful}</td>
    <td>£${total}</td>
  </tr>`;

const listPage = (rows, extra) => `<!doctype html><html><head><title>Account</title></head><body>
  <div class="customerAccount customer account">
    <div class="returnBl"><h2>My account</h2></div>
    <div class="customerAccount__addressBl">
      <h4>Default</h4>
      <p>Test Person<br>1 Fixture Road<br>Testville<br>TE5 7ER<br>United Kingdom</p>
      <a href="/account/addresses">View addresses (3)</a>
      <a href="/tools/recurring/login">Manage Subscription</a>
      <a href="/account/logout">Logout</a>
    </div>
    <div class="customerAccount__orderBl">
      <div class="returnBl"><h2>Order history</h2></div>
      <table><tbody>${rows}</tbody></table>
      ${extra || ""}
    </div>
  </div></body></html>`;

const item = (name, author, total, withLink, qty = 1) => `
  <tr>
    <td data-label="Product" class="orderTable__details">
      <img src="/img/${name.replace(/\W/g, "")}.png">
      ${withLink ? `<a class="orderTable__name" href="/products/${name.replace(/\W/g, "")}">${name}</a>`
                 : `<span class="orderTable__name">${name}</span>`}
      <span class="orderTable__author">${author}</span>
      <span class="orderTable__printing">1st</span>
      <div class="fulfillment"><span>Fulfilled <time datetime="2025-09-02">2 Sep 2025</time></span>
        <span>Royal Mail</span> #AB123456789GB</div>
    </td>
    <td data-label="Qty.">${qty}</td>
    <td data-label="Total">£${total}</td>
  </tr>`;

const orderPage = (items) => `<!doctype html><html><body>
  <table class="orderTable"><tbody>${items}</tbody></table></body></html>`;

const addressesPage = () => `<!doctype html><html><body>
  <div class="customerAddresses customer addresses">
    <ul class="customerAddresses__list">
      <li><h2>Default address</h2><p>Test Person<br>1 Fixture Road<br>Testville<br>TE5 7ER<br>United Kingdom</p>
        <button class="linkBtn" data-target="/account/addresses/111" data-confirm-message="Sure?">Delete</button></li>
      <li><p>Test Person<br>2 Other Street<br>Elsewhere<br>EL5 3WH<br>Portugal</p>
        <button class="linkBtn" data-target="/account/addresses/222" data-confirm-message="Sure?">Delete</button></li>
      <li><p>Test Person<br>3 Spare Lane<br>Nowhere<br>NW1 1AA<br>United Kingdom</p>
        <button class="linkBtn" data-target="/account/addresses/333" data-confirm-message="Sure?">Delete</button></li>
    </ul>
    <div class="customerAddresses__data">
      <form method="post" action="/account/addresses" id="address_form_new">
        <input type="hidden" name="form_type" value="customer_address"><input type="hidden" name="utf8" value="✓">
        <select name="address[country]">
          <option value="United States" selected>United States</option>
          <option value="United Kingdom">United Kingdom</option>
          <option value="Portugal">Portugal</option>
        </select>
        <select name="address[province]"></select>
      </form>
    </div>
  </div></body></html>`;

const page1 = listPage(
  row(1001, "2025-09-05T10:00:00Z", "September 5, 2025", "Paid", "Unfulfilled", "40.76") +
  row(1002, "2025-08-28T10:00:00Z", "August 28, 2025", "Paid", "Fulfilled", "41.82"),
  `<nav class="pagination"><a href="/account?page=2">2</a></nav>`);
const page2 = listPage(
  row(1003, "2025-05-13T10:00:00Z", "May 13, 2025", "Paid", "Fulfilled", "30.21") +
  row(1004, "2025-02-01T10:00:00Z", "February 1, 2025", "Refunded", "Fulfilled", "95.16"));

const orders = {
  "1001": orderPage(item("SF&F Subscription", "Various", "24.00", true, 3)),
  "1002": orderPage(item("The Dispossessed", "Ursula K. Le Guin", "25.00", false)),
  "1003": orderPage(item("Sister Wake", "Dave Rudden", "28.50", true)),
};

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const send = (code, body, delay = 0) => setTimeout(() => {
    res.writeHead(code, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  }, delay);
  if (req.method === "POST" && u.pathname.startsWith("/account/addresses")) return send(200, "ok");
  if (u.pathname === "/account" && u.searchParams.get("page") === "2") return send(200, page2, 1200);
  if (u.pathname === "/account") return send(200, page1);
  if (u.pathname === "/account/addresses") return send(200, addressesPage());
  const m = u.pathname.match(/^\/account\/orders\/(\d+)$/);
  if (m) return orders[m[1]] ? send(200, orders[m[1]]) : send(500, "boom");
  send(200, "<html></html>");
}).listen(PORT, "127.0.0.1", () => console.log("fixture on " + PORT));
