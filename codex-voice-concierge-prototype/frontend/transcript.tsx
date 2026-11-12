import React,{memo,useSyncExternalStore} from 'react';
import {ArrowDown} from 'lucide-react';
import {useStickToBottomContext} from 'use-stick-to-bottom';
import {Conversation,ConversationContent} from './ai-elements/conversation';
import {Message,MessageContent,MessageResponse} from './ai-elements/message';
import {getTranscript,subscribeTranscript} from './transcript-store.mjs';

const TranscriptMessage=memo(function TranscriptMessage({message}:{message:ReturnType<typeof getTranscript>[number]}){
  return <Message from={message.from} className="transcript-message">
    <div className="transcript-label">{message.label}</div>
    <MessageContent className="transcript-message-content">
      <MessageResponse className="transcript-markdown" isAnimating={message.streaming}>{message.text}</MessageResponse>
    </MessageContent>
  </Message>;
});
function ScrollToLatest(){
  const {isAtBottom,scrollToBottom}=useStickToBottomContext();
  return isAtBottom?null:<button className="transcript-scroll" aria-label="Scroll to latest message" onClick={()=>scrollToBottom()}><ArrowDown size={16}/></button>;
}
export function Transcript(){
  const messages=useSyncExternalStore(subscribeTranscript,getTranscript);
  return <Conversation className="transcript-conversation" aria-label="Voice and Codex transcript">
    <ConversationContent className="transcript-messages">
      {messages.map(message=><TranscriptMessage key={message.id} message={message}/>)}
    </ConversationContent>
    <ScrollToLatest/>
  </Conversation>;
}
