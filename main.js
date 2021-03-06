// Get the modhash, used to perform mod actions via the Reddit API
const modhash = $('form.logout input[name=uh]').val();

// Reddit API URLs
const flairUrl   = 'https://www.reddit.com/r/globaloffensive/api/flair';
const removeUrl  = 'https://www.reddit.com/r/globaloffensive/api/remove';
const commentUrl = 'https://www.reddit.com/r/globaloffensive/api/comment';
const stickyUrl  = 'https://www.reddit.com/r/globaloffensive/api/distinguish/yes';
const lockUrl    = 'https://www.reddit.com/r/globaloffensive/api/lock';

// Flairs Object as 'display text': 'id'
const linkFlairs = {
    'AMA'                       : 'ama',
    'Discussion'                : 'discussion',
    'Discussion | Esports'      : 'discussion esports',
    'Feedback'                  : 'feedback',
    'Fluff'                     : 'fluff',
    'Fluff | Esports'           : 'fluff esports',
    'Game Update'               : 'update',
    'Gameplay'                  : 'gameplay',
    'Gameplay | Esports'        : 'gameplay esports',
    'Help'                      : 'help',
    'News/Events'               : 'news',
    'News/Events | Esports'     : 'news esports',
    'Scheduled Sticky'          : 'sticky',
    'Stream Highlight'          : 'gameplay highlight',
    'Stream Highlight | Esports': 'gameplay highlight esports',
    'Tips/Guides'               : 'guides',
    'UGC'                       : 'ugc'
};

// Rules Object as 'rule name': 'hover text'
const rules = {
    'Rule 1: Relevancy'     : 'Relevancy',
    'Rule 2: Quality'       : 'Quality',
    'Rule 2b: Duplicate'    : 'Duplicate',
    'Rule 3: Support'       : 'Support',
    'Rule 4: Exploits'      : 'Exploits & Bugs',
    'Rule 5: Trading'       : 'Trading, Betting & Giveaways',
    'Rule 6: Scamming'      : 'Scamming & Cheating',
    'Rule 7: Witch-hunts'   : 'Accusations & Witch-hunts',
    'Rule 8: Advertising'   : 'Advertising',
    'Rule 9: Abuse'         : 'Abuse & Poor Behavior'
};

const editFlair = async (thing, flairCss, flairText) => {
    await apiRequest(flairUrl, {
        api_type: 'json',
        css_class: flairCss,
        link: thing,
        text: flairText,
        uh: modhash
    });

    $('#thing' + thing).addClass('linkflair');
};

const removeWithReason = async (ev, chromeGet, storage, thing, distinguish, ruleClicked, ruleDialog = null) => {
    let removalMessage = $( '#ruleText' ).val();

    if (!chromeGet.hasOwnProperty(ruleClicked)) {
        chromeGet[ruleClicked] = 'Your thread has been removed.  Please carefully [read our rules](https://www.reddit.com/r/GlobalOffensive/about/rules/) and ask if you have any questions.';
    }

    if (ruleDialog === null) {
        removalMessage = chromeGet[ruleClicked];
    }

    const removedThreadLink = 'https://redd.it/' + thing.replace('t3_', '');

    let footer = '';

    if (storage.footer !== '') {
        const footerText = storage.footer.replace('%%thread_link%%', removedThreadLink);
        footer = '\n\n---\n\n' + footerText;
    } else if (storage.footer === '') {
        footer = '';
    }

    const reason = removalMessage + footer;

    try {
        const remove = await apiRequest(removeUrl, {
            uh: modhash,
            id: thing,
            spam: 'false',
        });

        if (remove.ok) {
            const comment = await apiRequest(commentUrl, {
                parent: thing,
                text: reason,
                uh: modhash,
                api_type: 'json'
            }, true);

            const {errors} = comment.json;

            if (errors.length === 0 && distinguish) {
                const {things} = comment.json.data;
                await apiRequest(stickyUrl, {
                    id: things[0].data.id,
                    uh: modhash,
                    sticky: 'true'
                });

                if (ruleDialog) {
                    $(ruleDialog).dialog('close');
                }

                const dropDown = $(ev.target.parentNode).siblings('.rgo-dropdown');
                dropDown.html('removed');
                dropDown.removeClass('rgo-dropdown');

                return comment;
            }
        }
    } catch (err) {
        console.log(err);
    }
};

/**
 * Take a URL and search query parameters, build a URL, and fetch the response
 *
 * @param {String} url
 * @param {Object} params - URL query search parameters
 * @param {Boolean} json - Whether to return the JSONified response or the plain response object
 * @return {Promise<object>}
 */
const apiRequest = async (url, params, json = false) => {
    const requestUrl = new URL(url);
    requestUrl.search = new URLSearchParams(params).toString();

    const response = await fetch(requestUrl.toString(), { method: 'POST' });

    return json ? await response.json() : await response;
};

const checkNightMode = () => {
    const doModeLogic = () => {
        if ($('body').hasClass('res-nightmode')) {
            // Stop if we've already added the stylesheet
            if ($('link#rgo_nightmode').length) { return; }

            // Add the darkmode stylesheet
            $('<link/>', {
                rel: 'stylesheet',
                type: 'text/css',
                href: browser.runtime.getURL('style_nightmode_overrides.css'),
                id: 'rgo_nightmode'
            }).appendTo('head');
        } else {
            $('link#rgo_nightmode').remove();
        }
    };

    // Hook changes to body's classes to handle night mode changes
    new MutationObserver(() => { doModeLogic(); })
        .observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

    // Do a check once initially
    doModeLogic();
};

const addQuickFlair = () => {
    // Add our special button to all flatlists under threads
    $('.link .flat-list.buttons').each((i, e) => {
        // Skip elements we've already added the dropdown to
        if ($(e).has('.rgo-qf-dropdown').length) { return; }

        // Create selected option/trigger div
        const quickFlair = document.createElement('DIV');

        quickFlair.className = 'dropdown lightdrop rgo-qf-dropdown';

        const qfDrop = document.createElement('SPAN');
        qfDrop.className = 'selected';
        $(qfDrop).text('quick flair');

        quickFlair.appendChild(qfDrop);

        // Create flair selections div
        const flairChoices = document.createElement('DIV');
        flairChoices.className = 'drop-choices';

        // Loop through the flairs and add them to the dropdown
        for (const lf in linkFlairs) {
            const linkFlair = document.createElement('A');
            $(linkFlair).text(lf);

            linkFlair.title     = (lf === 'UGC') ? 'User Generated Content' : lf;
            linkFlair.className = 'choice';

            // When a
            $(linkFlair).click((ev) => {
                ev.preventDefault();
                let flairText = ev.target.innerHTML;
                const flairClicked = linkFlairs[flairText];

                if (flairText.includes('/')) {
                    flairText = flairText.replace('/', ' & ');
                }
                const id = $(ev.target).closest('.thing').attr('data-fullname');

                if (flairText === 'UGC') {
                    flairText = 'User Generated Content';
                }
                editFlair(id, flairClicked, flairText);

                const dd = $(ev.target.parentNode).siblings('.rgo-qf-dropdown');
                dd.html('flaired!');
                dd.removeClass('rgo-qf-dropdown');
            });

            flairChoices.appendChild(linkFlair);
        }

        const li = document.createElement('LI');
        const spacer = document.createElement('DIV');
        spacer.className = 'spacer';

        spacer.appendChild(quickFlair);
        spacer.appendChild(flairChoices);
        li.appendChild(spacer);
        e.appendChild(li);
    });
};

const addRemoveWithReasons = () => {
    const diaDiv  = document.createElement('DIV');
    const txtArea = document.createElement('TEXTAREA');

    diaDiv.id  = 'ruleDialog';
    txtArea.id = 'ruleText';
    diaDiv.appendChild(txtArea);

    $('#ruleDialog').hide();
    $('#ruleText').hide();

    $('#siteTable').append( diaDiv );

    // Add our special button to all flatlists under threads
    $('.link .flat-list.buttons').each((i, e) => {
        // Skip elements we've already added the dropdown to
        if ($(e).has('.rgo-dropdown').length) { return; }

        // Create selected option/trigger div
        const selected = document.createElement('DIV');

        selected.className = 'dropdown lightdrop rgo-dropdown';

        const selectedSpan = document.createElement('SPAN');
        selectedSpan.className = 'selected';
        $(selectedSpan).text('remove w/ reason');

        selected.appendChild(selectedSpan);

        // Create options div
        const options = document.createElement('DIV');
        options.className = 'drop-choices';

        for (const r in rules) {
            const ruleLink = document.createElement('A');

            $(ruleLink).text(r);
            ruleLink.title = rules[r];
            ruleLink.className = 'choice';

            $(ruleLink).click(async (ev) => {
                ev.preventDefault();
                const id = $(ev.target).closest('.thing').attr('data-fullname');
                const ruleClicked = $(ev.target).text().toLowerCase().replace(' ', '').split(':')[0];

                // Default values for the comments for each removal
                const chromeGet = {
                    rule1: "Your thread was removed under **[Rule 1](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule2: "Your thread was removed under **[Rule 2](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule2b: "Your thread was removed as a duplicate under **[Rule 2](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule3: "Your thread was removed under **[Rule 3](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule4: "Your thread was removed under **[Rule 4](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule5: "Your thread was removed under **[Rule 5](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule6: "Your thread was removed under **[Rule 6](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule7: "Your thread was removed under **[Rule 7](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule8: "Your thread was removed under **[Rule 8](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    rule9: "Your thread was removed under **[Rule 9](https://www.reddit.com/r/GlobalOffensive/about/rules/)**.",
                    footer: "Please take a moment to visit the rule linked above. Many rules contain details which may not be evident by the rule title. If you have any further questions or concerns, please send us a [modmail](https://www.reddit.com/message/compose?to=/r/GlobalOffensive)!",
                    oneTaps: ""
                };

                // Get rule data from browser storage
                const storage = await browser.storage.sync.get(chromeGet);

                if (storage.oneTaps) {
                    // If they want one click removals, don't show dialog
                    await removeWithReason(ev, chromeGet, storage, id, true, ruleClicked);
                } else {
                    // Show dialog on each click
                    const ruleDialog  = '#ruleDialog';

                    $('#ruleText').val(storage[ruleClicked])
                        .html(storage[ruleClicked])
                        .css('display', 'inline');

                    $(ruleDialog).dialog({
                        height  : 200,
                        width   : 700,
                        modal   : true,
                        title   : ev.target.innerHTML + ' Removal',
                        buttons : {
                            'Remove and lock comment': async () => {
                                const comment  = await removeWithReason(ev, chromeGet, storage, id, true, ruleClicked, ruleDialog);
                                const {things} = comment.json.data;

                                await apiRequest(lockUrl, {
                                    id: things[0].data.id,
                                    uh: modhash
                                });
                            },
                            'Get Salt': () => {
                                // This actually makes the POSTs happen and removes the thread, it also closes the dialog on completion
                                removeWithReason(ev, chromeGet, storage, id, true, ruleClicked, ruleDialog);
                            },
                            'Abort!' : () => {
                                $(ruleDialog).dialog('close');
                            }
                        }
                    });
                }
            });

            options.appendChild(ruleLink);
        }

        const li = document.createElement('LI');
        const spacer = document.createElement('DIV');
        spacer.className = 'spacer';

        spacer.appendChild(selected);
        spacer.appendChild(options);
        li.appendChild(spacer);
        e.appendChild(li);
    });
};

// Hook our functions
$(window).on('neverEndingLoad', () => {
    addQuickFlair();
    addRemoveWithReasons();
});

checkNightMode();
addQuickFlair();
addRemoveWithReasons();
