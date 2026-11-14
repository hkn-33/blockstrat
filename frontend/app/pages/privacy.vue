<script setup lang="ts">
usePageMeta(
  '/privacy',
  'Privacy Policy · BlockStrat',
  'What BlockStrat does with your data: no account, no cookies, no tracking, and what the server and the assistant see.',
)

const SECTIONS = [
  { id: 'short', title: 'The short version' },
  { id: 'controller', title: 'Who is responsible' },
  { id: 'visiting', title: 'Visiting the site' },
  { id: 'builder', title: 'Using the builder' },
  { id: 'assistant', title: 'The assistant' },
  { id: 'storage', title: 'Cookies and local storage' },
  { id: 'contact', title: 'Writing to us' },
  { id: 'recipients', title: 'Who else sees data' },
  { id: 'rights', title: 'Your rights' },
  { id: 'changes', title: 'Changes to this policy' },
]
</script>

<template>
  <LegalPage
    title="Privacy Policy"
    summary="BlockStrat has no accounts, sets no cookies and runs no analytics. This page says exactly what does reach a server when you use it, why, and for how long."
    :sections="SECTIONS"
  >
    <section id="short">
      <h2>The short version</h2>
      <ul>
        <li>You do not sign up, so we do not know your name or your email unless you write to us.</li>
        <li>No cookies, no analytics, no advertising, no tracking pixels. That is why there is no cookie banner.</li>
        <li>Your strategies stay in your browser. They reach our server only to be backtested, and are not stored there.</li>
        <li>Your IP address is seen by the hosting providers, as with any website, and is used only to deliver the site and to enforce usage limits.</li>
        <li>What you type to the assistant is sent to an AI provider, Groq. Do not type personal data into it.</li>
      </ul>
    </section>

    <section id="controller">
      <h2>Who is responsible</h2>
      <p>
        The controller of your personal data under the General Data Protection Regulation (GDPR) is
        <strong>{{ OPERATOR.name }}</strong>, a private individual based in {{ OPERATOR.country }}, who runs BlockStrat as a free,
        non-commercial project. Write to <a :href="`mailto:${OPERATOR.email}`">{{ OPERATOR.email }}</a> with any question about your
        data. There is no data protection officer, as none is required.
      </p>
    </section>

    <section id="visiting">
      <h2>Visiting the site</h2>
      <p>
        The pages are served by Vercel. To deliver them and keep the service secure, Vercel processes technical data your browser
        sends with every request: your IP address, the page requested, the time, your browser and operating system, and the referring
        page. Vercel keeps these logs for a short period under its own retention rules; we do not use them to identify or profile anyone.
      </p>
      <p>
        Legal basis: our legitimate interest in delivering a working, secure website (Article 6(1)(f) GDPR).
      </p>
      <p>
        Fonts and icons are served from BlockStrat itself, so loading a page does not send your address to a font or icon provider.
      </p>
    </section>

    <section id="builder">
      <h2>Using the builder</h2>
      <p>
        When you run a backtest, open a chart, search for strategies that match trades you marked, or use the assistant, your browser
        sends a request to our API server, hosted by cyber_Folks S.A. in Poland. The request carries the strategy or the marked trades
        and the market you picked. The server computes the answer and sends it back; it does not store the strategy.
      </p>
      <h3>Your IP address</h3>
      <p>
        The server sees your IP address and uses it for one thing: counting your requests against hourly limits, so a single user
        cannot overload a free service. The count is held only in the server's memory. Entries older than an hour stop counting and
        everything is gone when the server restarts. The server keeps no access log, and its error log records only the type of error
        and the address of the endpoint, never your IP address or what you sent.
      </p>
      <p>
        Legal basis: performing the service you asked for (Article 6(1)(b) GDPR) and our legitimate interest in keeping the service
        available to everyone (Article 6(1)(f) GDPR).
      </p>
      <h3>Market data</h3>
      <p>
        Prices come from Binance's public market data. Our server fetches them; your browser never contacts Binance, and Binance learns
        nothing about you.
      </p>
      <h3>Share links and files</h3>
      <p>
        A share link carries the whole strategy inside the link itself, compressed. We do not store shared strategies anywhere, so
        anyone you send the link to can read the strategy in it. Strategy files you download stay on your device.
      </p>
    </section>

    <section id="assistant">
      <h2>The assistant</h2>
      <p>
        The assistant turns a description into blocks. When you send it a message, our server forwards the text of your conversation
        and the strategy currently in the editor to Groq, Inc. (United States), which runs the language model, and sends the model's
        answer back to you. Groq receives the request from our server, not from your browser, so it does not see your IP address.
        Neither we nor Groq use the conversation to identify you, and we do not keep it after the answer is sent.
      </p>
      <p class="callout">
        Do not type personal data, account numbers, keys or passwords into the assistant. It needs none of them to build a strategy.
      </p>
      <p>
        Legal basis: performing the service you asked for (Article 6(1)(b) GDPR). Groq processes the text under its own terms and
        privacy policy, available at <a href="https://groq.com/privacy-policy" target="_blank" rel="noopener noreferrer">groq.com/privacy-policy</a>.
      </p>
    </section>

    <section id="storage">
      <h2>Cookies and local storage</h2>
      <p>
        BlockStrat sets no cookies. It keeps a few things in your browser's local storage so the builder remembers your work between
        visits. They never leave your device on their own, and we cannot read them.
      </p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">What it holds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><code>blockstrat-theme</code></th>
              <td>Light or dark mode, if you picked one.</td>
            </tr>
            <tr>
              <th scope="row"><code>blockstrat:current</code>, <code>blockstrat:current-name</code></th>
              <td>The strategy you are editing and its name, so a reload does not lose it.</td>
            </tr>
            <tr>
              <th scope="row"><code>blockstrat:library</code></th>
              <td>Strategies you saved with Save.</td>
            </tr>
            <tr>
              <th scope="row">Other <code>blockstrat:</code> keys</th>
              <td>
                Builder preferences (simple or advanced mode, hints, panel widths and layout, reward to risk) and, for each chart,
                the trades you marked and the strategies found for them.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Each of these exists only to provide something you asked for, so the law does not require your consent for them
        (Article 5(3) of the ePrivacy Directive, Article 399 of the Polish Electronic Communications Law). You can delete them at any
        time by clearing this site's data in your browser; the builder then starts empty.
      </p>
    </section>

    <section id="contact">
      <h2>Writing to us</h2>
      <p>
        If you email us, we use your address and what you write only to answer you and to handle the matter, for example a complaint
        under the <NuxtLink to="/terms">Terms of Service</NuxtLink>. The mailbox is provided by Google. We delete the conversation once
        the matter is closed and no longer needed, at the latest one year later.
      </p>
      <p>
        Legal basis: our legitimate interest in answering messages and handling complaints (Article 6(1)(f) GDPR).
      </p>
    </section>

    <section id="recipients">
      <h2>Who else sees data</h2>
      <p>These providers process data for us, each only for the purpose named:</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Provider</th>
              <th scope="col">Purpose</th>
              <th scope="col">Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Vercel Inc.</th>
              <td>Hosting the website</td>
              <td>United States, with servers in the EU</td>
            </tr>
            <tr>
              <th scope="row">cyber_Folks S.A.</th>
              <td>Hosting the API server</td>
              <td>Poland</td>
            </tr>
            <tr>
              <th scope="row">Groq, Inc.</th>
              <td>Running the assistant's language model</td>
              <td>United States</td>
            </tr>
            <tr>
              <th scope="row">Google</th>
              <td>The contact mailbox, only if you write to us</td>
              <td>United States and EU</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Where data leaves the European Economic Area, the transfer relies on the EU–U.S. Data Privacy Framework or on the European
        Commission's standard contractual clauses, as the provider offers. Write to us for a copy of the relevant safeguards. We do not
        sell data or share it with anyone else, and we make no decisions about you by automated means.
      </p>
    </section>

    <section id="rights">
      <h2>Your rights</h2>
      <p>Under the GDPR you can ask us to:</p>
      <ul>
        <li>tell you whether we process your data and give you a copy (Article 15);</li>
        <li>correct it (Article 16) or delete it (Article 17);</li>
        <li>restrict its processing (Article 18) or hand it to you in a portable format (Article 20);</li>
        <li>stop processing it where we rely on our legitimate interest (Article 21).</li>
      </ul>
      <p>
        Write to <a :href="`mailto:${OPERATOR.email}`">{{ OPERATOR.email }}</a>; we answer within one month. Because we keep almost
        nothing that identifies you, we may ask for details that let us find what concerns you, such as the time of your request.
      </p>
      <p>
        You can also complain to the Polish supervisory authority, the President of the Personal Data Protection Office
        (Prezes Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa, <a href="https://uodo.gov.pl" target="_blank" rel="noopener noreferrer">uodo.gov.pl</a>),
        or to the authority in the EU country where you live.
      </p>
      <p>
        You do not have to give us any personal data. Without your IP address the site cannot be delivered to you, which is how the
        internet works; everything else is up to you.
      </p>
    </section>

    <section id="changes">
      <h2>Changes to this policy</h2>
      <p>
        If what BlockStrat does with data changes, for example if it adds accounts or analytics, this page changes first and the date
        at the top moves. Anything that needs your consent will ask for it before it starts.
      </p>
    </section>
  </LegalPage>
</template>
