import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withPage } from './browser.mjs';

// One real Hangar load, generated audio and no venue tour or long track replay.
test('Hangar renders, keeps its camera and audio through a quality change, and releases held lights', {timeout:90000}, async()=>{
  await withPage(['--use-angle=swiftshader','--enable-unsafe-swiftshader'],async({send,evaluate,until,errors,port})=>{
    await send('Emulation.setDeviceMetricsOverride',{width:480,height:270,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:`http://127.0.0.1:${port}/?venue=hangar&quality=low&webgl`});
    await until('!!window.__show?.ready','Hangar did not start');
    assert.equal(await evaluate('window.__show.world.layout.name'),'Hangar');
    const options=await evaluate(`Array.from(document.getElementById('venue').options,o=>o.value)`);
    // Product has one venue; development may retain others privately.
    assert.ok(options.includes('hangar'));
    if(process.env.SV_PRODUCT_ONLY==='1') assert.deepEqual(options,['hangar']);
    await until('window.__show.signals.beats>=2','The demo did not advance');
    await evaluate(`document.getElementById('cam').value='2'; document.getElementById('cam').dispatchEvent(new Event('change'));`);
    assert.equal(await evaluate('window.__show.cams.auto'),false);
    await evaluate(`(async()=>{
      const a=window.__show.audio; await a.context();
      const osc=a.ctx.createOscillator(), dst=a.ctx.createMediaStreamDestination(), gain=a.ctx.createGain();
      gain.gain.value=0.05; osc.connect(gain).connect(dst); osc.start();
      await a.useStream(dst.stream,++a.request,'Generated input');
      window.__hangarProbe={stream:a.stream,source:a.source,ear:a.ear,ctx:a.ctx};
    })()`);
    await until('window.__show.audio.live && window.__show.audio.signal().level>0','Generated audio did not arrive');
    await evaluate(`document.getElementById('quality').value='normal'; document.getElementById('quality').dispatchEvent(new Event('change'));`);
    await until(`!window.__show.changing && window.__show.quality==='normal'`,'Quality change did not finish');
    assert.equal(await evaluate(`window.__show.world.layout.name==='Hangar' && document.getElementById('cam').value==='2' && window.__hangarProbe.stream===window.__show.audio.stream && window.__hangarProbe.source===window.__show.audio.source && window.__hangarProbe.ear===window.__show.audio.ear && window.__hangarProbe.ctx===window.__show.audio.ctx && window.__show.audio.stream.getAudioTracks()[0].readyState==='live'`),true);
    await evaluate(`dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}));`);
    assert.equal(await evaluate('window.__show.director.manual.strobe'),true);
    await evaluate(`dispatchEvent(new Event('blur'));`);
    assert.equal(await evaluate('window.__show.director.manual.strobe'),false);
    fs.mkdirSync('rec/look',{recursive:true});
    const shot=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('rec/look/hangar-check.png',Buffer.from(shot.data,'base64'));
    assert.deepEqual(errors,[]);
  });
});
