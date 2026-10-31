import {afterEach, beforeEach, expect, it, vi} from 'vitest';

let api: typeof import('./api');
const auth = {token:'rotated',user:{id:1,email:'owner@example.test'}};
const json = (value:unknown, status=200) => new Response(JSON.stringify(value),{status});
beforeEach(async()=>{vi.resetModules();api=await import('./api');vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>vi.unstubAllGlobals());

it('finishes server logout while clearing and cancelling the local session',async()=>{
  const {useHealthStore}=await import('../store/useHealthStore');
  let logoutSignal:AbortSignal|undefined;
  vi.mocked(fetch).mockImplementation(async(_url,init)=>{
    logoutSignal=init?.signal as AbortSignal;
    return json({success:true});
  });
  api.setToken('signed-session');useHealthStore.setState({token:'signed-session'});
  useHealthStore.getState().logout();
  expect(useHealthStore.getState().token).toBeNull();
  expect(logoutSignal?.aborted).toBe(false);
  expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer signed-session');
});

it('retries a delayed 401 with the already refreshed token without rotating again',async()=>{
  let release!:(response:Response)=>void;
  vi.mocked(fetch).mockImplementation(async(url,init)=>{
    if(String(url).endsWith('/auth/refresh'))return json(auth);
    if(String(url).endsWith('/slow')&&new Headers(init?.headers).get('Authorization')==='Bearer old')
      return new Promise(resolve=>{release=resolve;});
    return json({ok:true},new Headers(init?.headers).get('Authorization')==='Bearer old'?401:200);
  });
  api.setToken('old');
  const slow=api.apiFetch('/slow');
  await api.apiFetch('/fast');
  release(json({},401));
  expect((await slow).status).toBe(200);
  expect(vi.mocked(fetch).mock.calls.filter(([url])=>String(url).endsWith('/auth/refresh'))).toHaveLength(1);
});

it('does not let an obsolete refresh clear a replacement session',async()=>{
  let release!:(response:Response)=>void;
  const unauthorized=vi.fn();api.setUnauthorizedHandler(unauthorized);
  vi.mocked(fetch).mockImplementation(async url=>String(url).endsWith('/auth/refresh')?
    new Promise(resolve=>{release=resolve;}):json({},401));
  api.setToken('old');
  const old=api.apiFetch('/profile').catch(error=>error);
  await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
  api.clearToken();api.setToken('new-account');
  release(json({},401));
  expect(await old).toMatchObject({name:'AbortError'});
  expect(api.getToken()).toBe('new-account');expect(unauthorized).not.toHaveBeenCalled();
});

it('starts a fresh refresh after session reset while an obsolete request is settling',async()=>{
  let release!:(response:Response)=>void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve=>{release=resolve;})).mockResolvedValueOnce(json(auth));
  const obsolete=api.refreshSession();
  api.clearToken();
  const current=api.refreshSession();
  release(json({},401));
  expect(await obsolete).toBeNull();expect(await current).toEqual(auth);
  expect(api.getToken()).toBe(auth.token);
});

it('rejects a successful response with invalid JSON instead of treating it as data',async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response('<html>Proxy error</html>'));
  await expect(api.apiJson('/profile')).rejects.toThrow('invalid response');
});
