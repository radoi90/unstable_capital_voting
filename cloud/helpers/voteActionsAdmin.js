var _ = require('underscore');
var Company = Parse.Object.extend('Company');
var Vote = Parse.Object.extend('Vote');

// Updates the status of a vote by opening/closing it or tallying it.
exports.updateVote = function (companyId, params) {
	switch(params.method) {
		case 'toggle':
			var isVotingOpen = params.isVotingOpen === 'true';
			
			return toggleVote(companyId, isVotingOpen);
		case 'tally':
			return tallyVote(companyId);
	}
};

// Adds or revokes vote invites on a specified Company, for specified Partner
exports.updateVoters = function (action, partnerIds, companyId){
	switch (action) {
		case 'invite': return invite(partnerIds, companyId);
		case 'revoke': return revoke(partnerIds, companyId);
	}
}

// Toggles the open vote state to isOpen for a vote specified by companyId.
function toggleVote(companyId, isOpen) {
	var query = new Parse.Query(Company);
	
	return query.get(companyId).then(function(company) {
		if (company) {
			company.unset('result');
			return company.save({ isVotingOpen: isOpen });
		}
	});
};

// Computes result and closes vote for a vote specified by companyId.
function tallyVote(companyId) {
	var query = new Parse.Query(Company)
	.equalTo('objectId', companyId)
	.equalTo('isVotingOpen', true);

	return query.first().then(function (company) {
		if (company) { return getVotes(company.id); }
	}).then(function (votes) {
		if (votes) { return computeVoteResult(votes); }
	}).then(function(company){
		if (company) { return company.save({ isVotingOpen: false }); }
	});
};

// Gets all votes for a Company specified by companyId.
function getVotes(companyId) {
	var company = new Company();
	company.id = companyId;

	var query = new Parse.Query(Vote)
	.equalTo('company', company);

	return query.find();
};

// If all partners have voted, set the result as the average of their marks.
function computeVoteResult(votes) {
	var allPartnersVoted = votes.length > 0 && _.reduce(votes,
		function(allVoted, vote) { 
			return allVoted && vote.has('mark');
		}, true);

	if (allPartnersVoted) {
		var result =
			_.reduce(votes, function(sum, vote) { 
				return sum + vote.get('mark');
			}, 0) / votes.length;

		company = new Company();
		company.id = votes[0].get('company').id;
		return company.save({result: result});
	}
};

// Invites Partners specified by partnerIds to vote on a Company
// specified by companyId.
function invite(partnerIds, companyId) {
	var company = new Company();
	company.id = companyId;
	
	var votes = _.map(partnerIds, function(partnerId) {
		var partner = new Parse.User();
		partner.id = partnerId;

		var vote = new Vote();
		vote.set('company', company);
		vote.set('partner', partner);
		return vote;
	});

	return Parse.Object.saveAll(votes);
};

// Revokes invitations for Partners specified by partnerIds to vote
// on a Company specified by companyId.
function revoke(partnerIds, companyId) {
	var company = new Company();
	company.id = companyId;

	var partnerQuery = new Parse.Query(Parse.User)
	.containedIn('objectId', partnerIds);

	var query = new Parse.Query(Vote)
	.equalTo('company', company)
	.matchesQuery('partner', partnerQuery);

	return query.find().then(function(votes) {
		return Parse.Object.destroyAll(votes);
	});
};