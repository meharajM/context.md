#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AutomaticReminderModule, NSObject)

RCT_EXTERN_METHOD(getState:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setEnabled:(BOOL)enabled
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reconcileNote:(NSString *)noteId
                  fingerprint:(NSString *)fingerprint
                  enabledAt:(nonnull NSNumber *)enabledAt
                  inferredWithAi:(BOOL)inferredWithAi
                  planJson:(NSString *)planJson
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancelMissingNotes:(NSArray<NSString *> *)noteIds
                  enabledAt:(nonnull NSNumber *)enabledAt
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
