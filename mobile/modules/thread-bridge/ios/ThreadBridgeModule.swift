//
//  ThreadBridgeModule.swift
//  ThreadBridge
//
//  Expo module that bridges thread data from JS to native Swift
//

import ExpoModulesCore
import Foundation

public class ThreadBridgeModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ThreadBridge")

        // Set thread data from JavaScript
        Function("setThreadData") { (threadData: [String: Any]) in
            // Store thread data and broadcast notification
            NotificationCenter.default.post(
                name: NSNotification.Name("ThreadBridgeDataUpdated"),
                object: nil,
                userInfo: ["threadData": threadData]
            )
        }

        // Clear thread data
        Function("clearThreadData") {
            NotificationCenter.default.post(
                name: NSNotification.Name("ThreadBridgeDataCleared"),
                object: nil,
                userInfo: nil
            )
        }

        // Incremental update for a single post
        Function("updatePost") { (update: [String: Any]) in
            NotificationCenter.default.post(
                name: NSNotification.Name("ThreadBridgeIncrementalUpdate"),
                object: nil,
                userInfo: ["update": update]
            )
        }
    }
}
