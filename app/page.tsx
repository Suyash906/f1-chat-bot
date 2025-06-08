"use client"

import Image from "next/image"
import f1gpt from "./assets/f1gpt.png";
import {useChat} from "ai/react";
import { Message } from "ai";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";
import PromptSugesstionRow from "./components/PromptSugesstionRow";

const Home = () => {
    const {append, isLoading, messages, input, handleInputChange, handleSubmit} = useChat()
    const noMessages = !messages || messages.length === 0;
    const handlePrompt = ( promptText ) => {
        const msg: Message = {
            id: crypto.randomUUID(),
            content: promptText,
            role: "user"
        }
        append(msg);
    }
    return(
        <main>
            <Image src={f1gpt} width="250" alt="F1GPT"/>
            <section className={noMessages?"":"populated"}>
                {noMessages ? (
                    <>
                        <p className="starter-text">
                            The Ultimate place for Formula One Super fans
                            Ask F1GPT anything about the fantastic topic of F1 racing
                            and it will come back with most up-to-date answers.
                            We hope you enjoy!
                        </p>
                        <br/>
                        <PromptSugesstionRow onPromptClick={handlePrompt}/>
                    </>

                ):(
                    <>
                    {messages.map((message, index) => <Bubble key={`message-${index}`} message={message} /> )}
                    {isLoading && <LoadingBubble/>}
                    </>
                )}
                <form onSubmit={handleSubmit}>
                    <input className="question-box" onChange={handleInputChange} value={input} placeholder="Ask me something..."/>
                    <input type="submit"/>
                </form>
            </section>
        </main>
    )
}

export default Home;