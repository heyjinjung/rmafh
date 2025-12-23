import '../styles/globals.css';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>씨씨 신규금고서비스</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
