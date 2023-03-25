const axios = require('axios');
const puppeteer = require("puppeteer-core");
const { google } = require('googleapis');
const credentials = require('./credentials.json');
const sheetId = '1112wh9MtfOEpj0nBBhNIt_UZ4W5DfVB24FcV6yx4jP8';
const cors = require('cors');
const express = require('express');


const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const app = express();
app.use(cors());


app.get('/', async (req, res) => {
  res.send('Hello Tooths! How you doin?')
});

app.get('/run-mystifly',async(req,res)=>{
  try{
  const originXDest = req.query.origin;
  const finalXDest = req.query.destination;
  const tcdate = req.query.tcdate;
  const mystId = req.query.mystId;
  async function getApiResponse() {
    const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
  });
    const page = await browser.newPage();
    await page.goto('https://login.myfarebox.com');

    const headers ={
        'Authorization': `${mystId}`,
        'Content-Length': '624',
        'Content-Type': 'application/json'
    }

    const body ={"OriginDestinationInformations":[{"DepartureDateTime":`${tcdate}`,"OriginLocationCode":`${originXDest}`,"DestinationLocationCode":`${finalXDest}`}],"TravelPreferences":{"MaxStopsQuantity":"All","VendorPreferenceCodes":[],"VendorExcludeCodes":[],"CabinPreference":"S","Preferences":{"CabinClassPreference":{"CabinType":"Y","PreferenceLevel":"Preferred"}},"AirTripType":"OneWay"},"PricingSourceType":"All","IsRefundable":false,"PassengerTypeQuantities":[{"Code":"ADT","Quantity":"1"}],"RequestOptions":"TwoHundred","NearByAirports":true,"IsResidentFare":false,"Nationality":"","Target":"Test","ConversationId":"string","Provider":"All"}


    const response = await page.evaluate(({ headers, body }) => {
        return fetch('https://restapi.myfarebox.com/api/v2/Search/Flight', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    .then(response => response.json())
    .then(data => data)
    .catch(error => console.error(error));
    },{headers,body},{ timeout: 60000 });

    await browser.close();
    const fresponse = response;
    const flightSegments = fresponse.Data.FlightSegmentList;
    const fartypeslist = fresponse.Data.ItineraryReferenceList;
    const fareRef = fresponse.Data.PricedItineraries.map(items=>{
        return { FareRef: Number(items.FareRef) };
    });
    const farePricing = fresponse.Data.FlightFaresList;
    const pricingList = fresponse.Data.PricedItineraries.map(items=>items.OriginDestinations[0]);
    const mergedArray = pricingList.map((item, i) => {
        return Object.assign({}, item, fareRef[i]);
      });

    const trimArray = mergedArray.map(({ LegIndicator, ...rest }) => rest);

    const dataPush = trimArray.map(item => {
        const { SegmentRef, ItineraryRef, FareRef } = item;
        const segment = flightSegments[SegmentRef];
        const fareType =  fartypeslist[ItineraryRef];
        const farePrices =  farePricing[FareRef];

        
        return { SegmentRef: segment, ItineraryRef: fareType, FareRef: farePrices};
      });
    // console.log(dataPush);

    const finalJson = [];
    const dateNow = new Date();    
    const formattedDate = dateNow.toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      hour12: false 
    });

    dataPush.forEach(items => {
      const modifieddata = {
        logDate: formattedDate,
        provider:'Mystifly',
        airlineName: items.SegmentRef.MarketingCarriercode,
        airlineNumber: `${items.SegmentRef.MarketingCarriercode} - ${items.SegmentRef.MarketingFlightNumber}`,
        fareName: items.ItineraryRef.FareFamily,
        farePrice: items.FareRef.PassengerFare[0].TotalFare,
        stoppage: items.SegmentRef.ArrivalAirportLocationCode === finalXDest ?'Direct':'Indirect',
        originDest: originXDest,
        finalDest: finalXDest,
        departureDate: tcdate
      }
      finalJson.push(modifieddata);
    });
    // console.log(finalJson);

    const createRequest = {
      spreadsheetId: sheetId,
      range: 'mystifly!A2',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          ...finalJson.map(({logDate,provider,airlineName,airlineNumber,fareName,originDest,finalDest,departureDate,stoppage,farePrice}) =>
            [logDate,provider,airlineName,airlineNumber,fareName,originDest,finalDest,departureDate,stoppage,farePrice]
          )
        ],
      },
    };
    
    await sheets.spreadsheets.values.update(createRequest);
}
getApiResponse();
await getApiResponse();
res.send('Yes Yes Yes Yes I did it');
    } catch (error) {
      console.error(error);
      res.status(500).send('Watch Out! There is some critical error in the code');
    }

})


app.get('/run-katran', async (req, res) => {
    try{

    const originXDest = req.query.origin;
    const finalXDest = req.query.destination;
    const deptXDate = req.query.date;
    const traceId = req.query.traceId;
    const airlineFilter = req.query.airlineFilter;
    console.log(originXDest);
    // const tbocookies = req.query.tbocookies;
    
    console.log('tbocookies:', traceId);

    // Get Response from TBO Flight API
    async function getApiResponse() {
        const headers = {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.6',
            'cache-control': 'max-age=0',
            'content-length': '1132',
            'content-type': 'application/x-www-form-urlencoded',
            'cookie':`${traceId}`,
            'origin': 'https://m.travelboutiqueonline.com',
            'referer': 'https://m.travelboutiqueonline.com/FlightSearch.aspx',
            'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Brave";v="110"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'sec-gpc': '1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
              };

        const formData = new FormData();
        formData.append('ReturnType', '0');
        formData.append('LoginType', 'Agent');
        formData.append('Email', 'john15jacob@gmail.com');
        // formData.append('TraceId', '04f5b01e-6b51-41f5-a58b-1a9cf70bd45e');
        formData.append('SessionStamp', '832023141735978');
        formData.append('origin', originXDest);
        formData.append('destination', finalXDest);
        formData.append('departDate', deptXDate);
        formData.append('OutBoundTime', '00:00:00');
        formData.append('returnDate', '08-Mar-2023');
        formData.append('InBoundTime', '00:00:00');
        formData.append('hResultFareType', 'RegularFare');
        formData.append('hIsSpecialFare', 'False');
        formData.append('NoOfAdutls', '1');
        formData.append('NoOfChilds', '0');
        formData.append('NoOfInfants', '0');
        formData.append('CabinClass', '0');
        formData.append('GDSPrefferedAirlines', '');
        formData.append('PreferredCarrier', 'GDS');
        formData.append('PreferredCarrier', 'FZ');
        formData.append('PreferredCarrier', 'G9');
        formData.append('PreferredCarrier', 'AK');
        formData.append('PreferredCarrier', 'IX');
        formData.append('PreferredCarrier', 'SG');
        formData.append('PreferredCarrier', 'G8');
        formData.append('PreferredCarrier', '6E');
        formData.append('PreferredCarrier', 'DN');
        formData.append('PreferredCarrier', '2T');
        formData.append('PreferredCarrier', 'TZ');
        formData.append('PreferredCarrier', 'PY');
        formData.append('PreferredCarrier', 'XY');
        formData.append('PreferredCarrier', 'J9');
        formData.append('PreferredCarrier', 'OG');
        formData.append('PreferredCarrier', 'S9');
        formData.append('PreferredCarrier', '9I');
        formData.append('PreferredCarrier', 'QP');
        formData.append('LCCPreferredCarrier', 'G8');
        formData.append('LCCPreferredCarrier', '6E');
        formData.append('LCCPreferredCarrier', 'SG');
        formData.append('GDSPreferredCarrier', 'AI');
        formData.append('GDSPreferredCarrier', 'UK');
        formData.append('GDSPreferredCarrier', '9W');
        formData.append('GDSPreferredCarrier', 'S2');
        formData.append('searchType', '0');
        formData.append('OriginIsDomestic', 'true');
        formData.append('DestinationIsDomestic', 'true');
        formData.append('hTravelInfo', '');
        formData.append('hDeptdate', '');
        formData.append('hReturndate', '');
        formData.append('hAdult', '');
        formData.append('hChild', '');
        formData.append('hInfant', '');
        formData.append('hsearchToReturn', 'true');
        formData.append('hSwitchToAirportWiseSearch', 'True');
        const responses = await axios.post('https://m.travelboutiqueonline.com/FlightSearchResult.aspx', formData, { headers })
          .then(response => {
            return response;
          })
          .catch(error => {
            console.error(error);
          });
          return responses;
          
      }

     
      //Converting the Unstructured Data into Structured Data for TBO
      async function getApi() {
        const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
  });
        const page = await browser.newPage();
        const apiResponse = await getApiResponse();
        await page.setContent(apiResponse.data);
          
        const a = await page.evaluate(()=>{
    
            //Sare Hidden FareTypes bhi Show karne lag jaenge
            const hiddenElements = document.querySelectorAll('[style*="display:none"]');
            hiddenElements.forEach(element => {
                element.style.display = "block";
            });
    
            
            const tboscrap = [];
            
            const deptDate = document.querySelector('#headingmobile > p:last-child').innerText.split(',')[1].trim();
            const flightCards = Array.from(document.querySelectorAll('.result_p.row')).map((items)=>{
                const airlinename = items.querySelector('code > .mobile_not').innerText;
                const airlineNumber = items.querySelector('.fleft.width_100 > kbd').innerText;
                const originDest = items.querySelector('#mob_pad_deparr > kbd > em').innerText.split(' ')[0];
                const finalDest = items.querySelector('#mob_pad_deparr > kbd:last-child > em:nth-child(3)').innerText.split(' ')[0]
                const stoppage = items.querySelector('.duration_box.mobile_not.mt5 > a').innerText ===''?'Non-Stop':items.querySelector('.duration_box.mobile_not.mt5 > a').innerText;
                const fareType = Array.from(items.querySelectorAll('.flightprice > .tbofullwidth')).map((item)=>{
                    const fareName = item.querySelector('div > .pubbtnbox> div:last-child').innerText;
                    const farePrice = item.querySelector('div > .newprice.mobnewprice:nth-child(3)').innerText.replace('Rs. ','');
                    return `${fareName}:${farePrice}`;
                })
                // return `${airlinename}:${airlineNumber}:${originDest}:${finalDest}:${stoppage}:${fareType}`
                tboscrap.push({
                    deptDate,
                    airlinename,
                    airlineNumber,
                    originDest,
                    finalDest,
                    stoppage,
                    deptDate,
                    fareType
                  });
                  return tboscrap;
            })
            // return flightCards
            const finaltboScrap=[];
        tboscrap.forEach((items)=>{
            items.fareType.forEach((fares)=>{
                const dateNow = new Date();  
                const formattedDate = dateNow.toLocaleString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                hour12: false 
                });
                const [fareName,farePrice]= fares.split(':');
                const newFareCombo = {
                                logDate:formattedDate,
                                provider:'tbo',
                                airlineName:items.airlinename ==='GO FIRST'?'Go First': items.airlinename==='SpiceJet'?'Spicejet':items.airlinename,
                                airlineNumber:items.airlineNumber,
                                originDest:items.originDest,
                                finalDest:items.finalDest,
                                stoppage:items.stoppage,
                                deptDate:items.deptDate,
                                fareName:fareName,
                                farePrice:farePrice
                            };
                finaltboScrap.push(newFareCombo);           
           })
        })
        return finaltboScrap;
        })


        const tbofinal = a.filter(items=>{
          if(airlineFilter){
            return items.airlineName === `${airlineFilter}`
          }
          return items.airlineName
        })
        
        
        const createRequest = {
            spreadsheetId: sheetId,
            range: 'TBO V2!A2',
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [
                ...tbofinal.map(({logDate,provider,airlineName,airlineNumber,fareName,originDest,finalDest,stoppage,deptDate,farePrice}) =>
                  [logDate,provider,airlineName,airlineNumber,fareName,originDest,finalDest,stoppage,deptDate,farePrice]
                )
              ],
            },
          };
          
          await sheets.spreadsheets.values.update(createRequest);
          await browser.close();
      };
      getApi();
      await getApi();
      res.send('Yes Yes Yes Yes I did it');
    } catch (error) {
      console.error(error);
      res.status(500).send('Watch Out! There is some critical error in the code');
    }
  });

  app.get('/run-tc', async (req, res) => {
    try{
      const originXDest = req.query.origin;
      const finalXDest = req.query.destination;
      const tcdate = req.query.tcdate;
      const tcId = req.query.tcId;
      const airlineFilter = req.query.airlineFilter;
    
      console.log(airlineFilter);
      console.log(originXDest);
       //Get TC Responses from API
      async function getTcResponse() {
        const headers = {
          'accept': 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en-US,en;q=0.9',
      'authorization': `${tcId}`,
      'authorization-mode': 'AWSCognito',
      'content-length': '1000',
      'content-type': 'application/json',
      'origin': 'https://www.travclan.com',
      'referer': 'https://www.travclan.com/',
      'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Microsoft Edge";v="110"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': 'Windows',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'source': 'website',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.57'
        };
        
      const body = {"directFlight":"false","adultCount":"1","childCount":"0","infantCount":"0","flightCabinClass":"1","journeyType":"1","preferredDepartureTime":`${tcdate}`,"origin":`${originXDest}`,"destination":`${finalXDest}`,"memberCode":"mj7hj","organizationCode":"orfajd"};
      const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
  });
      const page = await browser.newPage();
      await page.goto('https://www.travclan.com');
      const response = await page.evaluate(({ headers, body }) => {
        return fetch('https://aggregator-flights-v1.travclan.com/api/v2/flights/search/', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
        .then(response => response.json())
        .then(data => data)
        .catch(error => console.error(error));
      }, { headers, body }, { timeout: 60000 });
      await browser.close();
      return response.response.results.outboundFlights;
    }
      
      
      const modifiedJsonArray = [];
      const originalJsonArray1 = [];

      //Modifying the TC_Data into My Structure 
      async function main() {
          const apiResponse = await getTcResponse();
          // console.log((apiResponse))
          originalJsonArray1.push(...apiResponse);
          const dateNow = new Date();  
          const formattedDate = dateNow.toLocaleString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit', 
          hour12: false 
          });

          originalJsonArray1.forEach(items=>{
            const modifieddata = {
              logDate: formattedDate,
              fareName: items.fareIdentifier.name,
              farePrice: items.fF,
              provider: items.pr === 'P2' ? 'TC_Tripjack' : items.pr === 'P3' ? 'TC_EMT' : items.pr === 'P1' ? 'TC_TBO': 'Null',
              airlineName: items.sg[0].al.alN === 'Airasia'?'Air Asia':items.sg[0].al.alN === 'Airasia India'?'Air Asia':items.sg[0].al.alN,
              airlineNumber: `${items.sg[0].al.alC} - ${items.sg[0].al.fN}`,
              orgDest:`${items.sg[0].or.aC}`,
              finDest: `${items.sg[items.sg.length-1].ds.aC}`,
              deptDate: `${items.sg[0].or.dT.split('T')[0]}`,
              stoppage: items.sg.length !== 1 ? 'Stops' : 'Non-Stop',
            }

          modifiedJsonArray.push(modifieddata);
          })

          const finalJson = modifiedJsonArray.filter(items=>{
            if(airlineFilter){
              return items.airlineName === `${airlineFilter}`
            }
            return items.airlineName
          })

          //Pushing the JSON Data in Sheet
          const updateRequest = {
            spreadsheetId: sheetId,
            range: 'TCv2!A2',
            // insertDataOption: 'INSERT_ROWS',
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [
                ...finalJson.map(({logDate,provider,airlineName,airlineNumber,fareName,orgDest,finDest,deptDate,stoppage,farePrice}) =>
                  [logDate,provider,airlineName,airlineNumber,fareName,orgDest,finDest,deptDate,stoppage,farePrice]
                )
              ],
            },
          };
          
          await sheets.spreadsheets.values.update(updateRequest);
      }
      main();
     await main();
     res.send('Successfully Scrapped');
    } catch (error) {
      console.error(error);
      res.status(500).send('Watch Out! There is some critical error in the code');
    }
      
  });


  app.get('/run-tripjack', async (req, res) => {
  try{
  const originXDest = req.query.origin;
  const finalXDest = req.query.destination;
  const tjdate = req.query.tcdate;
  const tjId = req.query.tjId;
  const airlineFilter = req.query.airlineFilter;
  async function gettripjackResponse() {
    const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
  });
    const page = await browser.newPage();
    await page.goto('https://www.travclan.com');
    
    const headers = {
        'authorization': `${tjId}`,
        'content-length': '373',
        'content-type': 'application/json',
        'currenv': 'prod',
        'origin': 'https://tripjack.com',
        'sec-fetch-mode': 'cors'
    };
    
    const body = {"searchQuery":{"cabinClass":"ECONOMY","preferredAirline":[],"searchModifiers":{"isDirectFlight":false,"isConnectingFlight":false,"sourceId":0,"pnrCreditInfo":{"pnr":""},"iiss":false,"pft":"REGULAR"},"routeInfos":[{"fromCityOrAirport":{"code":`${originXDest}`},"toCityOrAirport":{"code":`${finalXDest}`},"travelDate":`${tjdate}`}],"paxInfo":{"ADULT":1,"CHILD":0,"INFANT":0}},"isNewFlow":false};
    
    const response = await page.evaluate(({ headers, body }) => {
      return fetch('https://tripjack.com/fms/v1/air-searchquery-list', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      .then(response => response.json())
      .then(data => data)
      .catch(error => console.error(error));
    }, { headers, body });
  
    
    const searchIds =  response.searchIds;
    const baseUrl = 'https://tripjack.com/fms/v1/air-search/';
    const newUrls = searchIds.map(items=>{
        return baseUrl+items;
    })
    const newBody = searchIds.map(items=>({"searchId":`${items}`}))
    async function run(){
        const multipleFetch = newUrls.map(async (url,i) => {
  
            const responses = await page.evaluate(async(url,newBody,headers) => {
                
                const response = await fetch(url, {
                              method: 'POST',
                              headers: headers,
                              body: JSON.stringify(newBody)                       
                            })
                            return response.json();
                        },url,newBody[i],headers)
                
                return responses; 
            })
            
            const abc = await Promise.all(multipleFetch);
            // console.log(abc);
            return abc;
            
    }
    const responses1 = await run();
    const efx = responses1.filter(items=>{return items.hasOwnProperty('searchResult')})
    // console.log(efx.length);

    let e = responses1.filter(items=>{return items.hasOwnProperty('retryInSecond')})
    // console.log(e.length);
    
    let newSearchUrl = e.map(items=>{
        const baseUrl = 'https://tripjack.com/fms/v1/air-search/';
        return baseUrl+items.searchId;
    })
    // console.log(newSearchUrl);

    let newSearchBody = e.map(items=>{
        return ({"searchId":`${items.searchId}`});
    })
    // console.log(newSearchBody);


    //to generate new  url and body
    async function teedy(e){
      newSearchBody = e.map(items=>{
        return ({"searchId":`${items.searchId}`});
      })

      newSearchUrl = e.map(items=>{
        const baseUrl = 'https://tripjack.com/fms/v1/air-search/';
        return baseUrl+items.searchId;
    })
    }

    // to run multiple fetch
    async function runs(newSearchUrl, newSearchBody) {
        const multipleFetch = newSearchUrl.map(async (url, i) => {
            const responsesz = await page.evaluate(async(url,newSearchBody,headers) => {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(newSearchBody)
                  });
                  return response.json();
            },url,newSearchBody[i],headers); 
            return responsesz;
        });
        const yuv = await Promise.all(multipleFetch);
        return yuv;
      }

      do {
        const efg = await runs(newSearchUrl,newSearchBody);
      e = efg.filter(items=>{return items.hasOwnProperty('retryInSecond')})
      let success = efg.filter(items=>{return items.hasOwnProperty('searchResult')})
      efx.push(...success)    
      await teedy(e);
      }
      while (e.length);
      
      const extractedjson = efx.map(items=>{
        return items.searchResult.tripInfos.ONWARD
      })
      const modifiedJsonArray = [];
      const xyu = [].concat(...extractedjson);
      const dateNow = new Date();  
        const formattedDate = dateNow.toLocaleString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
      });
      xyu.forEach(items => {
        const modifieddata = {
          logDate: formattedDate,
          providerName: "TripJack",
          airlineName: items.processedTripInfo.aIs ? items.processedTripInfo.aIs[0].name : items.processedTripInfo.aI.name,
          airlineNumber: items.processedTripInfo.fN.join(','),
          originDest: items.processedTripInfo.aa,
          finalDest: items.processedTripInfo.da,
          stoppage: items.processedTripInfo.st >= 1 ? `${items.processedTripInfo.st}-Stops`:"Non-Stop",
          departureDate: items.processedTripInfo.dt.split('T')[0],
          fareTypes: items.processedTripInfo.pI
        }
        modifiedJsonArray.push(modifieddata);
      });
      // console.log(modifiedJsonArray);
      const newJsonTj = [];
      modifiedJsonArray.forEach(items=>{
        items.fareTypes.forEach(fares=>{
          const newJsonData = {
            logDate: items.logDate,
            providerName: "TripJack",
            airlineName: items.airlineName==='AirAsia India'?'Air Asia':items.airlineName==='SpiceJet'?'Spicejet':items.airlineName==='IndiGo'?'Indigo':items.airlineName,
            airlineNumber: items.airlineNumber.split(',')[0].replace('-',' - '),
            originDest: items.originDest,
            finalDest: items.finalDest,
            stoppage: items.stoppage,
            departureDate: items.departureDate,
            fareType: fares.ft,
            farePrice: fares.net - fares.tds
          }
          newJsonTj.push(newJsonData)
        })
      })

      const finalJson = newJsonTj.filter(items=>{
        if(airlineFilter){
          return items.airlineName === `${airlineFilter}`
        }
        return items.airlineName
      })
      // console.log(newJsonTj);
      const createRequest = {
        spreadsheetId: sheetId,
        range: 'tripjack!A2',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [
            ...finalJson.map(({logDate,providerName,airlineName,airlineNumber,fareType,originDest,finalDest,departureDate,stoppage,farePrice}) =>
              [logDate,providerName,airlineName,airlineNumber,fareType,originDest,finalDest,departureDate,stoppage,farePrice]
            )
          ],
        },
      };
      
      await sheets.spreadsheets.values.update(createRequest);
    }
    gettripjackResponse();
    await gettripjackResponse();
     res.send('Successfully Scrapped');
    } catch (error) {
      console.error(error);
      res.status(500).send('Watch Out! There is some critical error in the code');
    }
  })
  



  app.listen(process.env.PORT || 3000, () => {
    console.log("starting....");
  });