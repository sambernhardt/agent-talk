#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#include <node_api.h>
// Electron exposes an NSView pointer on macOS. Order its owning window using
// AppKit's public relative-window API, without activating either application.
static napi_value Below(napi_env env,napi_callback_info info){
 size_t argc=2; napi_value args[2],result; napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);
 void *bytes=nullptr; size_t length=0; uint32_t target=0;
 if(argc!=2 || napi_get_buffer_info(env,args[0],&bytes,&length)!=napi_ok || length!=sizeof(void*) || napi_get_value_uint32(env,args[1],&target)!=napi_ok || !target){
  napi_throw_type_error(env,nullptr,"Expected native window handle and Codex window ID");return nullptr;
 }
 NSView *view=(__bridge NSView *)(*(void **)bytes);
 // A lower level also prevents AppKit's click-to-front behavior from
 // raising the chin across the host's normal-level window.
 view.window.level=NSNormalWindowLevel-1;
 [view.window orderWindow:NSWindowBelow relativeTo:(NSInteger)target];
 napi_get_undefined(env,&result);return result;
}
static napi_value Round(napi_env env,napi_callback_info info){
 size_t argc=2;napi_value args[2],result;napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);
 bool bottomOnly=false;
 if(argc>1)napi_get_value_bool(env,args[1],&bottomOnly);
 void *bytes=nullptr;size_t length=0;
 if(argc<1||napi_get_buffer_info(env,args[0],&bytes,&length)!=napi_ok||length!=sizeof(void*)){
  napi_throw_type_error(env,nullptr,"Expected native window handle");return nullptr;
 }
 NSView *view=(__bridge NSView *)(*(void **)bytes);
 NSWindow *window=view.window;
 window.opaque=NO;window.backgroundColor=NSColor.clearColor;
 // Clip the native compositor surface, not just the HTML background.
 NSView *frame=window.contentView.superview ?: window.contentView;
 frame.wantsLayer=YES;
 frame.layer.cornerRadius=14;
 frame.layer.maskedCorners=bottomOnly
  ? (frame.layer.geometryFlipped ? kCALayerMinXMaxYCorner|kCALayerMaxXMaxYCorner : kCALayerMinXMinYCorner|kCALayerMaxXMinYCorner)
  : kCALayerMinXMinYCorner|kCALayerMaxXMinYCorner|kCALayerMinXMaxYCorner|kCALayerMaxXMaxYCorner;
 frame.layer.masksToBounds=YES;
 [window invalidateShadow];
 napi_get_undefined(env,&result);return result;
}
static napi_value Init(napi_env env,napi_value exports){
 napi_value fn;napi_create_function(env,"below",NAPI_AUTO_LENGTH,Below,nullptr,&fn);napi_set_named_property(env,exports,"below",fn);
 napi_create_function(env,"round",NAPI_AUTO_LENGTH,Round,nullptr,&fn);napi_set_named_property(env,exports,"round",fn);return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,Init)
