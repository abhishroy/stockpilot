import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';

const API = process.env.EXPO_PUBLIC_API_URL || 'https://stockpilot-idmk.onrender.com';
const HORIZONS = [1,2,3,4,5,12,24,36,48,60];
const fmt = (n,c='USD') => new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:2}).format(n);
export default function App(){
  const [ticker,setTicker]=useState('NVDA'); const [results,setResults]=useState([]); const [searching,setSearching]=useState(false); const [selected,setSelected]=useState('NVDA'); const [quote,setQuote]=useState(null); const [loading,setLoading]=useState(false);
  const [research,setResearch]=useState(null); const [researchLoading,setResearchLoading]=useState(false); const [error,setError]=useState(''); const [units,setUnits]=useState(10); const [months,setMonths]=useState(3); const [annual,setAnnual]=useState(20);
  async function findCompanies(){
    const q=ticker.trim(); if(!q)return;
    setSearching(true);setError('');setResults([]);
    try {const r=await fetch(`${API}/search?q=${encodeURIComponent(q)}`);const j=await r.json();if(!r.ok)throw new Error(j.detail||'Search failed');setResults(j.results||[]);if(!(j.results||[]).length)setError('No matching companies found. Try a ticker symbol.');}
    catch(e){setError(e.message);}finally{setSearching(false);}
  }
  async function chooseCompany(item){if(!item.is_public)return;setTicker(item.symbol);setSelected(item.symbol);setResults([]);await load(item.symbol);}
  async function loadResearch(symbol){setResearch(null);setResearchLoading(true);try{const r=await fetch(`${API}/research/${encodeURIComponent(symbol)}`);if(r.ok)setResearch(await r.json());}catch(e){}finally{setResearchLoading(false);}}
  async function load(symbolOverride){setLoading(true);setError('');setQuote(null);try{const r=await fetch(`${API}/quote/${String(typeof symbolOverride==='string'?symbolOverride:ticker).trim().toUpperCase()}`);const j=await r.json();if(!r.ok)throw new Error(j.detail||'Quote unavailable');setQuote(j);loadResearch(j.symbol);}catch(e){setError(e.message+' · Check backend URL and network.');}finally{setLoading(false);}}
  useEffect(()=>{load()},[]);
  const price=quote?.price||0; const future=price*Math.pow(1+annual/100,months/12); const profit=(future-price)*units;
  return <SafeAreaView style={s.root}><StatusBar barStyle="light-content"/><ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>STOCKPILOT · RESEARCH LAB</Text><Text style={s.title}>Invest with context.</Text><Text style={s.subtitle}>Market snapshots and transparent what-if scenarios.</Text>
    <View style={s.card}><Text style={s.label}>Search company or ticker</Text><View style={s.search}><TextInput autoCapitalize="words" value={ticker} onChangeText={setTicker} style={s.input} placeholder="Tesla, Nvidia, TSLA..." placeholderTextColor="#7b8798"/><TouchableOpacity onPress={findCompanies} style={s.button}><Text style={s.buttonText}>Search</Text></TouchableOpacity></View>
    {searching?<ActivityIndicator color="#62d8ac"/>:null}
    {results.map((item,i)=><TouchableOpacity key={`${item.symbol||item.name}-${i}`} onPress={()=>chooseCompany(item)} disabled={!item.is_public} style={s.result}><Text style={s.resultTitle}>{item.name} {item.symbol?`(${item.symbol})`:''}</Text><Text style={s.meta}>{item.is_public?`${item.exchange||'Exchange unknown'} · ${item.currency||'Currency unknown'}`:(item.message||'Private company · No listed shares')}</Text></TouchableOpacity>)}
    {loading?<ActivityIndicator color="#62d8ac"/>:null}{error?<Text style={s.error}>{error}</Text>:null}
    {quote?<><Text style={s.symbol}>{quote.symbol} <Text style={s.price}>{fmt(price,quote.currency)}</Text></Text><Text style={s.meta}>{quote.source} · {quote.quote_type}</Text><Text style={s.meta}>As of: {quote.as_of||'No timestamp (demo)'} · {quote.exchange||'Exchange not supplied'}</Text>{quote.is_demo?<Text style={s.warning}>DEMO PRICE ONLY. NOT A CURRENT MARKET QUOTE.</Text>:null}</>:null}</View>
    <View style={s.card}>
      <Text style={s.heading}>StockPilot Evidence Passport</Text>
      {researchLoading?<ActivityIndicator color="#62d8ac"/>:null}
      <Text style={s.researchStatus}>{research?.assessment==='INSUFFICIENT_EVIDENCE'?'Research signal: Not enough evidence':'Research signal: Pending verification'}</Text>
      <Text style={s.meta}>{research?.reason||'Select a company to load its research evidence.'}</Text>
      {research?<><Text style={s.researchTitle}>Evidence we have</Text>
      {(research.evidence||[]).map((e,i)=><View key={i} style={s.result}><Text style={s.resultTitle}>{e.category.replace(/_/g,' ')}</Text><Text style={s.meta}>{e.source} · {e.as_of||'Date not provided'}</Text><Text style={s.meta}>{e.note}</Text></View>)}
      {research.financials?<View style={s.result}>
        <Text style={s.researchTitle}>Company financials (reported figures)</Text>
        <Text style={s.meta}>These numbers come from the company's financial statement through FMP, not from a StockPilot prediction.</Text>
        <Text style={s.resultTitle}>Revenue: {research.financials.revenue == null?'Not available':fmt(Number(research.financials.revenue),research.financials.reported_currency||'USD')}</Text>
        <Text style={s.meta}>Revenue means the total money the company earned from selling its products and services.</Text>
        <Text style={s.resultTitle}>Net income: {research.financials.net_income == null?'Not available':fmt(Number(research.financials.net_income),research.financials.reported_currency||'USD')}</Text>
        <Text style={s.meta}>Net income is the profit remaining after the company's expenses and taxes.</Text>
        <Text style={s.meta}>Reporting period: {research.financials.period||'Unknown'} · Financial year: {research.financials.fiscal_year||'Unknown'} · Filed: {research.financials.filing_date||'Date unavailable'}</Text>
        <Text style={s.warning}>Source: FMP (secondary data provider). Figures must be checked against company filings before treating them as verified.</Text>
      </View>:null}
      {research.analysis?<View style={s.result}>
        <Text style={s.researchTitle}>How expensive is this company?</Text>
        <Text style={s.meta}>Market value: {research.analysis.market_cap==null?'Not available':fmt(research.analysis.market_cap,quote?.currency||'USD')}</Text>
        <Text style={s.meta}>Price compared with yearly profit: {research.analysis.market_cap_to_annual_net_income==null?'Not available':research.analysis.market_cap_to_annual_net_income+' times'}. This compares the total market value with reported annual profit, not whether the stock will rise.</Text>
        <Text style={s.researchTitle}>How much does the company owe?</Text>
        <Text style={s.meta}>Total debt: {research.analysis.total_debt==null?'Not available':fmt(research.analysis.total_debt,research.financials?.reported_currency||'USD')}</Text>
        <Text style={s.meta}>Cash available: {research.analysis.cash==null?'Not available':fmt(research.analysis.cash,research.financials?.reported_currency||'USD')}</Text>
        <Text style={s.meta}>Debt compared with shareholder equity: {research.analysis.debt_to_equity==null?'Not available':research.analysis.debt_to_equity+' times'}</Text>
        <Text style={s.meta}>Balance sheet date: {research.analysis.balance_sheet_date||'Not provided'}</Text>
        <Text style={s.warning}>Provider figures only. Not independently checked against company filings. These numbers are not a Buy or Sell signal.</Text>
      </View>:null}
      <Text style={s.researchTitle}>Economic and world events</Text>
      <Text style={s.meta}>Verified company-specific economic and geopolitical analysis is not available yet. Interest rates, industry conditions and global events can change stock prices. StockPilot will not guess their impact.</Text>
      <Text style={s.researchTitle}>How accurate are past signals?</Text>
      <Text style={s.meta}>Not tested yet. We cannot claim an accuracy rate or show invented backtest results.</Text>
      <Text style={s.researchTitle}>What is still missing</Text>
      {(research.missing||[]).map((item,i)=><Text key={i} style={s.meta}>• {item}</Text>)}
      <Text style={s.researchTitle}>Recent sourced headlines (not scored)</Text>
      {(research.news||[]).length===0?<Text style={s.meta}>No verified news feed available.</Text>:(research.news||[]).map((n,i)=><Text key={i} style={s.meta}>{n.title} · {n.publisher} · {n.published_at||'Date unknown'} · {n.url}</Text>)}
      <Text style={s.researchTitle}>Audit details</Text>
      <Text style={s.meta}>Model: {research.model_version} · Generated: {research.generated_at}</Text>
      <Text style={s.meta}>Evidence fingerprint: {research.evidence_fingerprint}</Text>
      <Text style={s.meta}>Historical performance: Not validated. No accuracy claims.</Text></>:null}
      <Text style={s.warning}>StockPilot does not issue Buy / Hold / Sell ratings without independently verified financials, valuation, news context and historical validation.</Text>
    </View>
    <View style={s.card}><Text style={s.heading}>Scenario calculator</Text><Text style={s.label}>Shares</Text><View style={s.row}>{[1,10].map(n=><TouchableOpacity key={n} style={[s.chip,units===n&&s.active]} onPress={()=>setUnits(n)}><Text style={s.chipText}>{n} share{n===1?'':'s'}</Text></TouchableOpacity>)}</View>
    <Text style={s.label}>Time horizon</Text><View style={s.wrap}>{HORIZONS.map(n=><TouchableOpacity key={n} style={[s.chip,months===n&&s.active]} onPress={()=>setMonths(n)}><Text style={s.chipText}>{n<12?`${n}M`:`${n/12}Y`}</Text></TouchableOpacity>)}</View>
    <Text style={s.label}>What if the share price changes by {annual}% per year?</Text><Slider minimumValue={-60} maximumValue={80} step={5} value={annual} onValueChange={setAnnual} minimumTrackTintColor="#62d8ac" maximumTrackTintColor="#455264" thumbTintColor="#62d8ac"/>
    <View style={s.stats}><View><Text style={s.label}>Investment</Text><Text style={s.stat}>{fmt(price*units,quote?.currency||'USD')}</Text></View><View><Text style={s.label}>Hypothetical value</Text><Text style={s.stat}>{fmt(future*units,quote?.currency||'USD')}</Text></View></View>
    <Text style={s.label}>Potential profit / loss</Text><Text style={[s.big,{color:profit>=0?'#62d8ac':'#ff8e9a'}]}>{profit>=0?'+':''}{fmt(profit,quote?.currency||'USD')}</Text>
    <Text style={s.meta}>Scenario based on a manually selected annual return, NOT a stock-price prediction. Fees, FX, dividends and taxes excluded.</Text></View>
    <Text style={s.footer}>Educational research tool · No personalized investment advice · v0.4 research preview</Text>
  </ScrollView></SafeAreaView>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#0b1220'},content:{padding:22,paddingBottom:50},eyebrow:{color:'#62d8ac',fontSize:12,fontWeight:'700',letterSpacing:2,marginTop:14},title:{fontSize:32,color:'#fff',fontWeight:'800',marginTop:8},subtitle:{color:'#9eacbc',marginTop:7,marginBottom:20},card:{backgroundColor:'#172335',borderRadius:20,padding:20,marginBottom:16,borderWidth:1,borderColor:'#263449'},label:{color:'#a4b3c4',fontSize:12,marginBottom:10,marginTop:8},search:{flexDirection:'row',gap:8},input:{flex:1,color:'#fff',borderColor:'#394b61',borderWidth:1,borderRadius:10,padding:12,fontSize:18},button:{backgroundColor:'#62d8ac',paddingHorizontal:20,borderRadius:10,justifyContent:'center'},buttonText:{color:'#0b1220',fontWeight:'800'},symbol:{fontSize:21,color:'#fff',fontWeight:'700',marginTop:20},price:{color:'#62d8ac'},meta:{color:'#a4b3c4',fontSize:11,marginTop:7,lineHeight:17},warning:{color:'#ffd280',fontSize:12,marginTop:10,fontWeight:'700'},error:{color:'#ff8e9a',marginTop:12},heading:{color:'#fff',fontWeight:'700',fontSize:20,marginBottom:8},row:{flexDirection:'row',gap:8,marginBottom:10},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12},chip:{paddingVertical:9,paddingHorizontal:12,borderRadius:10,backgroundColor:'#2a3b50'},active:{backgroundColor:'#267e68'},chipText:{color:'#fff',fontWeight:'600'},stats:{flexDirection:'row',justifyContent:'space-between',marginTop:14},stat:{color:'#fff',fontSize:17,fontWeight:'700'},big:{fontSize:30,fontWeight:'800',marginTop:4},result:{padding:12,borderRadius:10,backgroundColor:'#24364b',marginTop:8},researchStatus:{color:'#ffd280',fontSize:16,fontWeight:'700',marginBottom:8},researchTitle:{color:'#fff',fontSize:14,fontWeight:'700',marginTop:14},resultTitle:{color:'#fff',fontSize:15,fontWeight:'700'},footer:{color:'#7f8da0',fontSize:11,textAlign:'center',marginTop:8}});
