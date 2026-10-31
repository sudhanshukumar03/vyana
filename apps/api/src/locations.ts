import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import axios from 'axios';
import {z} from 'zod';
import {asyncRoute,HttpError} from './auth';

export function locationRoutes(keys:{geoapifyKey?:string;ninjasKey?:string}={}) {
  const router=Router();
  router.use(rateLimit({windowMs:60000,limit:30,keyGenerator:(_req,res)=>String(res.locals.user.id),standardHeaders:'draft-8',legacyHeaders:false}));
  const coords=z.object({lat:z.coerce.number().min(-90).max(90),lon:z.coerce.number().min(-180).max(180)});
  async function provider(url:string,params:object,key?:string,ninjas=false) {
    if(!key)throw new HttpError(503,'Location search is not configured. Add the provider key on the API server.');
    try {return (await axios.get(url,{params:ninjas?params:{...params,apiKey:key},headers:ninjas?{'X-Api-Key':key}:{},timeout:8000,maxRedirects:0,maxContentLength:1048576})).data;}
    catch {throw new HttpError(503,'The location provider is unavailable. Please retry.');}
  }
  router.get('/geoapify/geocode/search',asyncRoute(async(req,res)=>{
    const {text}=z.object({text:z.string().trim().min(1).max(200)}).strict().parse(req.query);
    res.json(await provider('https://api.geoapify.com/v1/geocode/search',{text,limit:5},keys.geoapifyKey));
  }));
  router.get('/geoapify/geocode/reverse',asyncRoute(async(req,res)=>{
    res.json(await provider('https://api.geoapify.com/v1/geocode/reverse',coords.strict().parse(req.query),keys.geoapifyKey));
  }));
  router.get('/geoapify/places',asyncRoute(async(req,res)=>{
    const {lat,lon,radius}=coords.extend({radius:z.coerce.number().int().min(100).max(50000)}).strict().parse(req.query);
    res.json(await provider('https://api.geoapify.com/v2/places',{categories:'healthcare.hospital,healthcare.clinic_or_praxis',filter:`circle:${lon},${lat},${radius}`,bias:`proximity:${lon},${lat}`,limit:25},keys.geoapifyKey));
  }));
  router.get('/ninjas/hospitals',asyncRoute(async(req,res)=>{
    const input=z.object({city:z.string().trim().min(1).max(100).optional(),state:z.string().trim().min(1).max(100).optional(),zipcode:z.string().regex(/^\d{5}$/).optional(),name:z.string().trim().min(1).max(100).optional()}).strict().refine(value=>Object.keys(value).length>0).parse(req.query);
    res.json(await provider('https://api.api-ninjas.com/v1/hospitals',input,keys.ninjasKey,true));
  }));return router;
}
