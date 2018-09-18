import * as React from "react";
import * as Cards from "../cards/cards";
import { shuffle } from "../cards/shuffle";
import DrawResult from "./DrawResult";
import * as ArtFinder from "../cards/artFinder";
import Deck from "./Deck";
import { Navbar } from './Navbar';
import { LFSR } from "../cards/lfsr";
import update from "immutability-helper";
import ReactModal = require('react-modal');
import { NewDeckDialog } from './NewDeckDialog';

import '../styles/app.scss';

interface Props {
}

interface State {
  // This is null if and only if there are no decks.
  currentDeckIndex: number | null,
  currentCard: Cards.OrientedCard | null,
  decks: ReadonlyArray<Cards.Deck>,
  showNewDeckDialog: boolean
}

const decksStorageKey = 'decks';

export default class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const savedDecks = localStorage.getItem(decksStorageKey);
    const decks = savedDecks ? JSON.parse(savedDecks) : [];
    this.state = {
      decks,
      currentDeckIndex: decks.length != 0 ? 0 : null,
      currentCard: null,
      showNewDeckDialog: false
    };

    this.handleShowNewDeckDialog = this.handleShowNewDeckDialog.bind(this);
    this.handleNewDeck = this.handleNewDeck.bind(this);
    this.handleDeleteDeck = this.handleDeleteDeck.bind(this);
    this.handleSelectDeck = this.handleSelectDeck.bind(this);
    this.handleDraw = this.handleDraw.bind(this);
    this.handleShuffle = this.handleShuffle.bind(this);
    this.saveState = this.saveState.bind(this);

    // Needed since componentWillUnmount isn't called if the user is reloading the page.
    window.addEventListener("beforeunload", this.saveState);
  }

  componentWillUnmount() {
    this.saveState();
    window.removeEventListener("beforeunload", this.saveState);
  }

  private handleShowNewDeckDialog() {
    this.setState({ showNewDeckDialog: true });
  }

  handleNewDeck(deck: Cards.Deck) {
    console.debug(`Creating new deck named ${deck.name}`);
    this.setState((state) => ({
      decks: [...state.decks, deck],
      currentDeckIndex: state.decks.length,
      showNewDeckDialog: false
    }));
  }

  handleDeleteDeck() {
    const index = this.state.currentDeckIndex;
    if (index === null) {
      console.error('Attempted to delete a deck at index null?');
      return;
    }
    const deck = this.state.decks[index];
    if (!confirm(`Are you sure you want to delete the deck "${deck.name}"? This cannot be undone.`)) {
      return;
    }

    console.debug(`Deleting deck ${index}`);
    this.setState((state) =>
      update(state, {
        decks: { $splice: [[index, 1]] },
        currentDeckIndex: { $set: null }
      })
    );
  }

  handleSelectDeck(deck: Cards.Deck, index: number) {
    console.debug(`Selecting deck ${index}`);
    this.setState((state) => ({
      currentDeckIndex: index
    }));
  }

  saveState() {
    console.log("Saving state to localStorage");
    window.localStorage.setItem(decksStorageKey, JSON.stringify(this.state.decks));
  }

  currentDeck(): Cards.Deck | null {
    if (this.state.currentDeckIndex !== null) {
      return this.state.decks[this.state.currentDeckIndex];
    } else {
      return null;
    }
  }

  private handleDraw() {
    this.setState((state) => {
      const index = this.state.currentDeckIndex;
      if (index === null) {
        throw new Error("null currentDeckIndex");
      }
      const topCard = state.decks[index].cards[0];
      console.info("Drew", topCard);
      const currentCard = topCard;
      const numCards = state.decks[index].cards.length;
      let newDecks = update(state.decks,
        { [index]: { cards: { $splice: [[0, 1]] } } });
      newDecks = update(newDecks,
        { [index]: { cards: { $push: [topCard] } } });
      return { decks: newDecks, currentCard }
    });
  }

  private handleShuffle(fingerprint: number) {
    const lfsr = new LFSR(fingerprint);
    console.debug("Shuffling deck");
    this.setState((state) => {
      const index = this.state.currentDeckIndex;
      if (index === null) {
        throw new Error("null currentDeckIndex");
      }
      let repeatedShuffle = function <T>(cards: Array<Cards.OrientedCard>) {
        // Ten times is enough to get some actual mixing.
        for (let i = 0; i < 10; i++) {
          cards = shuffle(cards, lfsr);
        }
        return cards;
      }

      return update(state,
        { decks: { [index]: { cards: repeatedShuffle } } });
    });
  }

  render() {
    const currentDeck = this.currentDeck();
    return (
      <div>
        <Navbar decks={this.state.decks}
          onDeckSelect={this.handleSelectDeck}
          onNewDeck={this.handleShowNewDeckDialog} />
        {currentDeck &&
          <Deck onDraw={this.handleDraw}
            onShuffle={this.handleShuffle}
            onDelete={this.handleDeleteDeck}
            deck={currentDeck} />}
        <div id="draw-result-container">
          <DrawResult card={this.state.currentCard} />
        </div>

        <ReactModal
          isOpen={this.state.showNewDeckDialog}
          className="modal"
          overlayClassName="overlay"
          closeTimeoutMS={200}>
          <NewDeckDialog onNewDeck={this.handleNewDeck} />
        </ReactModal>
      </div>
    );
  }
}
