module.exports = {
    BOXEN_OPTIONS: {
        borderStyle: 'double',
        margin: { top: 2 },
        padding: { left: 3, right: 3 }
    },
    CALAIS_ENTITY_CATEGORIES: {
        'Event': [ 'Anniversary', 'Date', 'EntertainmentAwardEvent', 'Holiday', 'PoliticalEvent', 
            'SportsEvent', 'SportsGame', 'SportsLeague', 'TVShow' ],
        'HumanProtagonist': [ 'Editor', 'Journalist', 'MusicGroup', 'Person' ],
        'OrganizationProtagonist': [ 'Company', 'Organization' ],
        'Position': [ 'Position' ],
        'Location': [ 'City', 'Continent', 'Country', 'Facility', 'NaturalFeature', 'ProvinceOrState', 
            'Region' ],
        'Product': [ 'Movie', 'MusicAlbum', 'OperatingSystem', 'PharmaceuticalDrug', 'Product', 
            'ProgrammingLanguage', 'PublishedMedium', 'RadioProgram', 'RadioStation', 'SportsLeague',
            'Technology', 'TVShow', 'TVStation' ]
    }
}