import Foundation
import AVFoundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8)); exit(1)
}
let engine = AVAudioEngine()
let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 24000, channels: 1, interleaved: false)!
let mode = CommandLine.arguments.dropFirst().first ?? ""
if mode == "capture" {
    let input = engine.inputNode
    let source = input.outputFormat(forBus: 0)
    guard source.sampleRate > 0, let converter = AVAudioConverter(from: source, to: format) else { fail("No microphone or unsupported microphone format.") }
    input.installTap(onBus: 0, bufferSize: 1024, format: source) { buffer, _ in
        let capacity = AVAudioFrameCount(ceil(Double(buffer.frameLength) * 24000 / source.sampleRate) + 64)
        guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { return }
        var supplied = false
        var error: NSError?
        converter.convert(to: output, error: &error) { _, status in
            if supplied { status.pointee = .noDataNow; return nil }
            supplied = true; status.pointee = .haveData; return buffer
        }
        if let error = error { fail(error.localizedDescription) }
        guard let samples = output.floatChannelData?[0] else { return }
        var pcm = [Int16](repeating: 0, count: Int(output.frameLength))
        for i in pcm.indices { pcm[i] = Int16(max(-32767, min(32767, samples[i] * 32767))).littleEndian }
        pcm.withUnsafeBytes { FileHandle.standardOutput.write(Data($0)) }
    }
    do { try engine.start() } catch { fail("Microphone unavailable: \(error). Allow microphone access for the host app in System Settings.") }
    FileHandle.standardError.write(Data("READY\n".utf8))
    RunLoop.main.run()
} else if mode == "play" {
    let player = AVAudioPlayerNode()
    engine.attach(player); engine.connect(player, to: engine.mainMixerNode, format: format)
    do { try engine.start() } catch { fail("Audio output unavailable: \(error)") }
    player.play()
    // Bound queued audio to roughly two seconds; pipe backpressure bounds the producer.
    let slots = DispatchSemaphore(value: 48)
    var pending = Data()
    while true {
        let bytes = FileHandle.standardInput.availableData
        if bytes.isEmpty { break }
        pending.append(bytes)
        while pending.count >= 2048 {
            let chunk = pending.prefix(2048); pending.removeFirst(2048)
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
            buffer.frameLength = 1024
            chunk.withUnsafeBytes { raw in
                for i in 0..<1024 {
                    let low = UInt16(raw[i * 2]); let high = UInt16(raw[i * 2 + 1]) << 8
                    buffer.floatChannelData![0][i] = Float(Int16(bitPattern: low | high)) / 32768
                }
            }
            slots.wait()
            player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { _ in slots.signal() }
        }
    }
    player.stop(); engine.stop()
} else { fail("Expected capture or play") }
