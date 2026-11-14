<script setup lang="ts">
usePageMeta(
  '/terms',
  'Terms of Service · BlockStrat',
  'The rules for using BlockStrat: a backtester for your own crypto strategies, free for personal use and not investment advice.',
)

const SECTIONS = [
  { id: 'provider', title: 'Who provides BlockStrat' },
  { id: 'service', title: 'What BlockStrat does' },
  { id: 'advice', title: 'Not investment advice' },
  { id: 'agreement', title: 'Starting and ending' },
  { id: 'requirements', title: 'What you need' },
  { id: 'use', title: 'Fair use' },
  { id: 'assistant', title: 'The assistant' },
  { id: 'availability', title: 'Availability and changes' },
  { id: 'liability', title: 'Liability' },
  { id: 'ownership', title: 'Ownership' },
  { id: 'complaints', title: 'Complaints' },
  { id: 'law', title: 'Law and changes to these terms' },
]
</script>

<template>
  <LegalPage
    title="Terms of Service"
    summary="The rules for using BlockStrat, a free tool that tests trading ideas on past prices. These terms are the rules required by the Polish Act on Providing Services by Electronic Means; using the builder means you accept them."
    :sections="SECTIONS"
  >
    <section id="provider">
      <h2>Who provides BlockStrat</h2>
      <p>
        BlockStrat is provided by <strong>{{ OPERATOR.name }}</strong>, a private individual based in {{ OPERATOR.country }}
        ("we", "us"), free of charge and not as a business. Contact: <a :href="`mailto:${OPERATOR.email}`">{{ OPERATOR.email }}</a>.
      </p>
      <p>
        "You" means anyone using BlockStrat. "The builder" means the application at <NuxtLink to="/app">/app</NuxtLink>;
        "the site" means the builder together with the pages around it.
      </p>
    </section>

    <section id="service">
      <h2>What BlockStrat does</h2>
      <p>
        BlockStrat is a tool for building and testing your own trading strategies. It lets you, without an account and free of charge
        for personal use:
      </p>
      <ul>
        <li>build a trading strategy from ready-made blocks, or describe it to the assistant, which proposes the blocks;</li>
        <li>backtest the strategy: replay it on historical Binance prices for the supported crypto pairs and see the simulated trades, fees and results;</li>
        <li>mark trades on a price chart and get strategies whose rules would have taken similar trades;</li>
        <li>save strategies in your browser, download them as files, export them as Pine Script and share them by link.</li>
      </ul>
      <p>
        BlockStrat never places orders, never connects to an exchange account, never asks for exchange keys and never holds money or
        crypto. It is a simulator only.
      </p>
      <p>
        BlockStrat is in beta: features, limits and results may change while it is being built. Personal use is free. Using the site
        for a business, for example in a fund, a trading firm or a paid course, needs a separate agreement: write to
        <a :href="`mailto:${OPERATOR.email}`">{{ OPERATOR.email }}</a>.
      </p>
    </section>

    <section id="advice">
      <h2>Not investment advice</h2>
      <p class="callout">
        BlockStrat is a tool for building and testing your own strategies. It does not recommend trades, and nothing on it is
        investment advice or an offer to buy or sell anything. A strategy that did well on past prices can lose money in the future.
        Decide your trades yourself, and only risk money you can afford to lose.
      </p>
      <ul>
        <li>
          Backtests are simulations on historical data. They model fees and slippage with simple assumptions, fill orders at the next
          candle and cannot reproduce real liquidity, outages, funding costs or your own behaviour.
        </li>
        <li>
          Market data comes from Binance and may contain gaps or errors. Results depend on the period, market and settings you pick.
        </li>
        <li>
          Templates, the strategies found from marked trades and the assistant's answers are examples of what can be built, not
          suggestions of what to trade.
        </li>
        <li>
          BlockStrat is not an investment firm and provides no investment services within the meaning of MiFID II or the Polish Act
          on Trading in Financial Instruments.
        </li>
      </ul>
    </section>

    <section id="agreement">
      <h2>Starting and ending</h2>
      <p>
        The agreement to use BlockStrat starts when you open the builder and ends when you close it. You can stop at any time, without
        giving a reason and at no cost, and you need not tell us. Strategies saved in your browser remain there until you delete them.
      </p>
      <p>
        We may block access for anyone who breaks the fair use rules below, for example by blocking an IP address that floods the server.
      </p>
    </section>

    <section id="requirements">
      <h2>What you need</h2>
      <ul>
        <li>an internet connection and a current version of Chrome, Edge, Firefox or Safari, with JavaScript enabled;</li>
        <li>local storage enabled in the browser, if you want the builder to remember your work;</li>
        <li>for the builder itself, a screen at least the size of a phone; it works best on a laptop or desktop.</li>
      </ul>
      <p>
        Like any service on the internet, using BlockStrat carries the usual risks of the internet, such as malware on your device or
        someone intercepting traffic on an unsafe network. The site is served only over an encrypted connection (HTTPS). Keep your
        browser and system updated and do not share links to strategies you want to keep private: anyone with the link can read it.
      </p>
    </section>

    <section id="use">
      <h2>Fair use</h2>
      <p>When using BlockStrat you must not:</p>
      <ul>
        <li>submit content that is unlawful, including in strategy names and messages to the assistant;</li>
        <li>attack, overload or probe the site or its server, or try to get around its usage limits, for example by spreading requests over many addresses;</li>
        <li>use bots or scripts to download market data or results in bulk;</li>
        <li>try to make the assistant do anything other than build strategies, or extract its instructions;</li>
        <li>present BlockStrat's results as investment advice or as a promise of returns to other people.</li>
      </ul>
      <p>
        The site limits how many backtests, chart loads, strategy searches and assistant messages one address can make each hour.
        During the beta the assistant answers up to {{ AI_MESSAGES_PER_HOUR }} messages an hour. When you reach a limit, the builder
        asks you to try again later.
      </p>
    </section>

    <section id="assistant">
      <h2>The assistant</h2>
      <p>
        The assistant uses a language model provided by Groq. Its answers can be wrong or incomplete: it may misread your description,
        choose different values or leave something out. It always answers with blocks you can see, so check every rule before you rely
        on a result. It is available only while the daily allowance lasts; when it runs out, build the blocks by hand.
      </p>
      <p>
        Do not send it personal data. The <NuxtLink to="/privacy">Privacy Policy</NuxtLink> explains what happens to your messages.
      </p>
    </section>

    <section id="availability">
      <h2>Availability and changes</h2>
      <p>
        BlockStrat is a free project provided as it is. We do our best to keep it running and correct, but we do not promise that it
        will be available at all times, free of errors, or that any feature, market or data period will stay. We may change, limit or
        stop the service, in whole or in part, at any time; if we shut it down, we will say so on the site in advance where we can.
      </p>
    </section>

    <section id="liability">
      <h2>Liability</h2>
      <p>
        Because BlockStrat is free and only simulates trades, we are not liable for decisions you make based on it, including losses
        from trading, or for lost strategies, for example after you clear your browser's data. Keep a downloaded copy of strategies
        that matter to you.
      </p>
      <p>
        This does not limit liability for damage caused intentionally, or any liability that the law does not allow to be limited,
        including the rights consumers have under mandatory law.
      </p>
    </section>

    <section id="ownership">
      <h2>Ownership</h2>
      <p>
        BlockStrat's source code is open source under the
        <a :href="SOURCE_URL" target="_blank" rel="noopener">GNU Affero General Public License v3.0</a>: you may use, change and share
        it under that license. These terms cover the site at {{ SITE_URL.replace('https://', '') }}, not the code. The BlockStrat name
        and logo belong to {{ OPERATOR.name }} and are not part of the license.
      </p>
      <p>
        Strategies you build are yours: use, share and publish them as you like. Market data is Binance's and is shown under its
        terms. Coin and company logos belong to their owners and appear only to identify the markets and services named.
      </p>
    </section>

    <section id="complaints">
      <h2>Complaints</h2>
      <p>
        If something does not work as these terms describe, write to <a :href="`mailto:${OPERATOR.email}`">{{ OPERATOR.email }}</a>.
        Say what happened, when, and what you expect us to do, and attach a strategy file or link if it helps us reproduce the problem.
        We answer within 14 days, by email.
      </p>
      <p>
        If you are a consumer, you can also turn for free help to a municipal or district consumer ombudsman (rzecznik konsumentów)
        or to the consumer organisations listed by the Polish Office of Competition and Consumer Protection at
        <a href="https://uokik.gov.pl" target="_blank" rel="noopener noreferrer">uokik.gov.pl</a>.
      </p>
    </section>

    <section id="law">
      <h2>Law and changes to these terms</h2>
      <p>
        These terms are governed by Polish law. If you are a consumer living in another country, you keep the protection of the
        mandatory law of that country. Disputes go to the court that has jurisdiction under the general rules.
      </p>
      <p>
        We may change these terms, for example when BlockStrat gains new features or legal requirements change. The new version is
        published on this page with a new date and applies from your next use of the builder; since there are no accounts, nothing
        carries over without you coming back.
      </p>
    </section>
  </LegalPage>
</template>
