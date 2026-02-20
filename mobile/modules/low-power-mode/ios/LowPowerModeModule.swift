//
// LowPowerModeModule.swift
// Low Power Mode Bridge
//
// Expo Module that exposes iOS Low Power Mode state to JS.
// Sends events when the power state changes so the JS layer
// can adapt polling, prefetching, and background work.
//

import ExpoModulesCore

public class LowPowerModeModule: Module {
    private var observer: NSObjectProtocol?

    public func definition() -> ModuleDefinition {
        Name("LowPowerMode")

        Events("onLowPowerModeChanged")

        /// Returns the current Low Power Mode state synchronously
        Function("isLowPowerModeEnabled") { () -> Bool in
            return ProcessInfo.processInfo.isLowPowerModeEnabled
        }

        OnStartObserving {
            self.observer = NotificationCenter.default.addObserver(
                forName: .NSProcessInfoPowerStateDidChange,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                let isEnabled = ProcessInfo.processInfo.isLowPowerModeEnabled
                self?.sendEvent("onLowPowerModeChanged", [
                    "isLowPowerMode": isEnabled
                ])
            }
        }

        OnStopObserving {
            if let observer = self.observer {
                NotificationCenter.default.removeObserver(observer)
                self.observer = nil
            }
        }
    }
}
