import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
const HORIZONS = [1,2,3,4,5,12,24,36,48,60];
const fmt = (n,c='USD') => new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:2}).format(n);
export default function App(){
  const [ticker,setTicker]=useState('NVDA'); const [results,setResults]=useState([]); const [searching,setSearching]=useState(false); const [selected,setSelected]=useState('NVDA'); const [quote,setQuote]=useState(null); const [loading,setLoading]=useState(false);
  const [error,setError]=useState(''); const [units,setUnits]=useState(10); const [months,setMonths]=useState(3); const [annual,setAnnual]=useState(20);
  async function findCompanies(){
    const q=ticker.trim(); if(!q)return;
    setSearching(true);setError('');setResults([]);
    try {const r=await fetch(`${API}/search?q=${encodeURIComponent(q)}`);const j=await r.json();if(!r.ok)throw new Error(j.detail||'Search failed');setResults(j.results||[]);if(!(j.results||[]).length)setError('No matching companies found. Try a ticker symbol.');}
    catch(e){setError(e.message);}finally{setSearching(false);}
  }
  async function chooseCompany(item){if(!item.is_public)return;setTicker(item.symbol);setSelected(item.symbol);setResults([]);await load(item.symbol);}
  async function load(symbolOverride){setLoading(true);setError('');setQuote(null);try{const r=await fetch(`${API}/quote/${String(typeof symbolOverride==='string'?symbolOverride:ticker).trim().toUpperCase()}`);const j=await r.json();if(!r.ok)throw new Error(j.detail||'Quote unavailable');setQuote(j);}catch(e){setError(e.message+' · Check backend URL and network.');}finally{setLoading(false);}}
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
      <Text style={s.heading}>StockPilot research assessment</Text>
      <Text style={s.researchStatus}>Not enough evidence for Buy / Hold / Sell</Text>
      <Text style={s.meta}>A share price alone cannot tell us whether a company is a good investment. Verified financial statements, valuation data and a licensed news feed are not yet connected. StockPilot will not invent a recommendation.</Text>
      <Text style={s.researchTitle}>What we know now</Text>
      <Text style={s.meta}>{quote && !quote.is_demo ? `Latest provider quote for ${quote.symbol}: ${fmt(quote.price,quote.currency)} (as of ${quote.as_of||'date unavailable'}). This is a price snapshot, not a valuation.` : 'Select a company to load a quote. Demo prices are not investment evidence.'}</Text>
      <Text style={s.researchTitle}>What we still need to check</Text>
      <Text style={s.meta}>{'• Sales, profits and debt\n• Whether the shares are expensive or cheap relative to earnings\n• Company news, leadership and regulation\n• Oil, interest rates, wars and other relevant risks'}</Text>
      <Text style={s.researchTitle}>How future signals will work</Text>
      <Text style={s.meta}>Attractive means worth researching further. Watch means mixed evidence. Caution means significant concerns. None is a guarantee or an instruction to trade.</Text>
      <Text style={s.warning}>Live news-driven ratings are not available yet. No headlines or confidence scores are fabricated.</Text>
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
